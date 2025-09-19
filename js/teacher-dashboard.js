// --------------------
// Teacher Dashboard JS
// --------------------

let currentSection = 'overview';
let currentSubmissionId = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();

    if (window.appState.userRole !== 'teacher') {
        window.location.href = 'dashboard-student.html';
        return;
    }

    await loadUserInfo();
    await loadDashboardData();
    initializeEventListeners();
});

// --------------------
// Load user info
// --------------------
async function loadUserInfo() {
    try {
        const user = window.appState.currentUser;
        const { data: profile } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        const userInfoDiv = document.getElementById('userInfo');
        userInfoDiv.innerHTML = `
            <h4>${profile.full_name}</h4>
            <p>Teacher</p>
        `;
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// --------------------
// Dashboard Data
// --------------------
async function loadDashboardData() {
    try {
        if (!window.appState || !window.appState.currentUser) {
            console.error('User not authenticated');
            return;
        }
        const teacherId = window.appState.currentUser.id;

        const [classes, assignments, submissions] = await Promise.all([
            window.supabase.from('classes').select('*').eq('teacher_id', teacherId),
            window.supabase.from('assignments').select('id').eq('teacher_id', teacherId),
            window.supabase.from('submissions')
                .select('id, assignments!inner(id, title, teacher_id), profiles(full_name), grades(id)')
                .eq('assignments.teacher_id', teacherId)
                .is('grades.id', null)
        ]);

        // Update stats
        document.getElementById('classCount').textContent = classes.data?.length || 0;
        document.getElementById('assignmentCount').textContent = assignments.data?.length || 0;
        document.getElementById('submissionCount').textContent = submissions.data?.length || 0;

        // Count unique students from class enrollments
        if (classes.data && classes.data.length > 0) {
            const classIds = classes.data.map(c => c.id);
            const { data: enrollments } = await window.supabase
                .from('class_enrollments')
                .select('student_id')
                .in('class_id', classIds);
            
            const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []);
            document.getElementById('studentCount').textContent = uniqueStudents.size;
        } else {
            document.getElementById('studentCount').textContent = 0;
        }

        // Load recent submissions
        await loadRecentSubmissions();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// --------------------
// Recent Submissions
// --------------------
async function loadRecentSubmissions() {
    try {
        if (!window.appState || !window.appState.currentUser) {
            console.error('User not authenticated');
            return;
        }
        const teacherId = window.appState.currentUser.id;

        const { data: submissions, error } = await window.supabase
            .from('submissions')
            .select('*, assignments!inner(title, teacher_id), profiles(full_name), grades(id)')
            .eq('assignments.teacher_id', teacherId)
            .is('grades.id', null)
            .order('submitted_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        const container = document.getElementById('recentSubmissions');
        if (!submissions || submissions.length === 0) {
            window.utils.showEmptyState(container, 'No recent submissions', 'Student submissions will appear here');
            return;
        }

        container.innerHTML = submissions.map(sub => `
            <div class="activity-item">
                <div class="activity-icon">📤</div>
                <div class="activity-content">
                    <h4>${sub.profiles.full_name} submitted ${sub.assignments.title}</h4>
                    <p>${window.utils.formatTimeAgo(sub.submitted_at)}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading recent submissions:', error);
    }
}

// --------------------
// Navigation
// --------------------
function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionName).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.target.classList.add('active');
    currentSection = sectionName;

    switch(sectionName) {
        case 'classes': loadClasses(); break;
        case 'assignments': loadAssignments(); break;
        case 'submissions': loadSubmissions('pending'); break;
        case 'resources': loadResources(); break;
        case 'grades': loadGradesManagement(); break;
    }
}

// --------------------
// Classes
// --------------------
async function loadClasses() {
    try {
        if (!window.appState || !window.appState.currentUser) {
            console.error('User not authenticated');
            window.utils.showNotification('Please log in first', 'error');
            return;
        }
        const teacherId = window.appState.currentUser.id;
        const { data: classes, error } = await window.supabase
            .from('classes')
            .select('*')
            .eq('teacher_id', teacherId);
        
        if (error) throw error;

        const container = document.getElementById('classesList');
        if (!classes || classes.length === 0) {
            window.utils.showEmptyState(container, 'No classes created', 'Create your first class to get started');
            return;
        }

        // Get student counts and assignment counts for each class
        const classesWithCounts = await Promise.all(
            classes.map(async (c) => {
                const [enrollments, assignments] = await Promise.all([
                    window.supabase.from('class_enrollments').select('id').eq('class_id', c.id),
                    window.supabase.from('assignments').select('id').eq('class_id', c.id)
                ]);
                
                return {
                    ...c,
                    studentCount: enrollments.data?.length || 0,
                    assignmentCount: assignments.data?.length || 0
                };
            })
        );

        container.innerHTML = classesWithCounts.map(c => `
            <div class="class-card">
                <div class="class-header">
                    <div>
                        <h3 class="class-title">${c.name}</h3>
                        <p class="class-subject">${c.subject}</p>
                    </div>
                    <div class="class-code">${c.class_code}</div>
                </div>
                <div class="class-description">${c.description || 'No description provided'}</div>
                <div class="class-stats">
                    <span>Students: ${c.studentCount}</span>
                    <span>Assignments: ${c.assignmentCount}</span>
                    <span>Created: ${window.utils.formatDate(c.created_at)}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

// --------------------
// Assignments
// --------------------
async function loadAssignments() {
    try {
        if (!window.appState || !window.appState.currentUser) {
            console.error('User not authenticated');
            return;
        }
        const teacherId = window.appState.currentUser.id;
        const { data: assignments, error } = await window.supabase
            .from('assignments')
            .select(`
                *,
                classes(name)
            `)
            .eq('teacher_id', teacherId)
            .order('due_date', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('assignmentsList');
        if (!assignments || assignments.length === 0) {
            window.utils.showEmptyState(container, 'No assignments created', 'Create your first assignment');
            return;
        }

        container.innerHTML = assignments.map(a => `
            <div class="assignment-card">
                <div class="assignment-header">
                    <div>
                        <h3 class="assignment-title">${a.title}</h3>
                        <div class="assignment-meta">
                            Class: ${a.classes.name} | Due: ${window.utils.formatDateTime(a.due_date)} | Points: ${a.max_points}
                        </div>
                    </div>
                    <div class="assignment-status status-active">Active</div>
                </div>
                <div class="assignment-description">${a.description}</div>
                <div class="assignment-actions">
                    <button class="btn-secondary btn-small" onclick="viewAssignmentSubmissions('${a.id}')">View Submissions</button>
                    <button class="btn-primary btn-small" onclick="editAssignment('${a.id}')">Edit</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading assignments:', error);
    }
}

// --------------------
// Resources
// --------------------
async function loadResources() {
    try {
        const teacherId = window.appState.currentUser.id;
        
        // Get all classes taught by this teacher
        const { data: classes, error: classError } = await window.supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', teacherId);
        
        if (classError) throw classError;
        
        if (!classes || classes.length === 0) {
            const container = document.getElementById('resourcesGrid');
            if (container) {
                window.utils.showEmptyState(container, 'No classes yet', 'Create a class to see student resources');
            }
            return;
        }
        
        const classIds = classes.map(c => c.id);
        
        // Get all resources from enrolled students
        const { data: resources, error: resourceError } = await window.supabase
            .from('resources')
            .select(`
                *,
                profiles!resources_user_id_fkey(full_name),
                subjects(name),
                chapters(name)
            `)
            .eq('is_public', true)
            .order('created_at', { ascending: false });
        
        if (resourceError) throw resourceError;
        
        displayTeacherResources(resources);
    } catch (error) {
        console.error('Error loading resources:', error);
        window.utils.showNotification('Failed to load resources', 'error');
    }
}

function displayTeacherResources(resources) {
    const container = document.getElementById('resourcesGrid');
    if (!container) return;
    
    if (resources.length === 0) {
        window.utils.showEmptyState(container, 'No student resources', 'Students haven\'t shared any resources yet');
        return;
    }
    
    container.innerHTML = resources.map(resource => `
        <div class="resource-card">
            <div class="resource-header">
                <h3>${resource.title}</h3>
                <div class="resource-meta">
                    <span>${resource.subjects?.name || 'General'}</span>
                    <span class="resource-type">${resource.resource_type}</span>
                </div>
                <div class="resource-meta">
                    <span>by ${resource.profiles?.full_name || 'Unknown'}</span>
                    <span>${window.utils.formatTimeAgo(resource.created_at)}</span>
                </div>
            </div>
            <div class="resource-body">
                <div class="resource-description">
                    ${resource.description || 'No description available'}
                </div>
                <div class="resource-actions">
                    <button class="btn-secondary btn-small" onclick="viewResource('${resource.id}')">View</button>
                    <button class="btn-primary btn-small" onclick="approveResource('${resource.id}')">Feature</button>
                </div>
            </div>
        </div>
    `).join('');
}

// --------------------
// Modal Handlers
// --------------------
function showCreateClassModal() { document.getElementById('createClassModal').style.display = 'block'; }
function closeCreateClassModal() { document.getElementById('createClassModal').style.display = 'none'; }
async function showCreateAssignmentModal() { 
    const modal = document.getElementById('createAssignmentModal');
    if (modal) {
        modal.style.display = 'block';
        await loadClassesForAssignment();
    }
}

function closeCreateAssignmentModal() { 
    const modal = document.getElementById('createAssignmentModal');
    if (modal) {
        modal.style.display = 'none';
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

async function loadClassesForAssignment() {
    try {
        const teacherId = window.appState.currentUser.id;
        const { data: classes, error } = await window.supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', teacherId);
        
        if (error) throw error;
        
        const classSelect = document.getElementById('assignmentClass');
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Select Class</option>' +
                classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading classes for assignment:', error);
    }
}

async function handleCreateClass(event) {
  event.preventDefault();

  try {
    if (!window.appState || !window.appState.currentUser) {
      window.utils.showNotification('Please log in first', 'error');
      return;
    }
    
    const teacherId = window.appState.currentUser.id;
    const name = document.getElementById('className').value.trim();
    const subject = document.getElementById('classSubject').value.trim();
    const description = document.getElementById('classDescription').value.trim();
    let classCode = document.getElementById('classCode').value.trim();

    if (!name || !subject || !classCode) {
      window.utils.showNotification('Name, Subject, and Class Code are required.');
      return;
    }

    // Check if class code already exists and generate a unique one if needed
    const { data: existingClass } = await window.supabase
      .from('classes')
      .select('id')
      .eq('class_code', classCode)
      .maybeSingle();
    
    if (existingClass) {
      // Generate a unique class code by appending a number
      let counter = 1;
      let newClassCode = `${classCode}${counter}`;
      
      while (true) {
        const { data: checkClass } = await window.supabase
          .from('classes')
          .select('id')
          .eq('class_code', newClassCode)
          .maybeSingle();
        
        if (!checkClass) {
          classCode = newClassCode;
          break;
        }
        counter++;
        newClassCode = `${classCode.replace(/\d+$/, '')}${counter}`;
      }
      
      window.utils.showNotification(`Class code '${document.getElementById('classCode').value}' was taken, using '${classCode}' instead`, 'warning');
    }

    const { data, error } = await window.supabase
      .from('classes') // insert into the actual table
      .insert([{
        teacher_id: teacherId,
        name,
        subject,
        description,
        class_code: classCode
      }]);

    if (error) throw error;

    closeCreateClassModal();
    await loadClasses(); // refresh class list
    window.utils.showNotification('Class created successfully!');
  } catch (error) {
    console.error('Error creating class:', error);
    window.utils.showNotification('Failed to create class.');
  }
}



async function handleCreateAssignment(event) {
    event.preventDefault();
    
    const title = document.getElementById('assignmentTitle').value.trim();
    const classId = document.getElementById('assignmentClass').value;
    const description = document.getElementById('assignmentDescription').value.trim();
    const dueDate = document.getElementById('assignmentDueDate').value;
    const maxPoints = parseInt(document.getElementById('assignmentMaxPoints').value, 10);
    const teacherId = window.appState.currentUser.id;

    if (!title || !classId || !description || !dueDate || !maxPoints) {
        window.utils.showNotification('Please fill all required fields.', 'error');
        return;
    }

    try {
        const { data, error } = await window.supabase
            .from('assignments')
            .insert([{
                title,
                class_id: classId,
                teacher_id: teacherId,
                description,
                due_date: dueDate,
                max_points: maxPoints,
                is_published: true
            }]);
        
        if (error) throw error;
        
        window.utils.showNotification('Assignment created successfully!', 'success');
        closeCreateAssignmentModal();
        await loadAssignments();
        await loadDashboardData();
    } catch (err) {
        console.error('Error creating assignment:', err);
        window.utils.showNotification(`Failed to create assignment: ${err.message}`, 'error');
    }
}
window.handleCreateAssignment = handleCreateAssignment;

function showGradeModal(submissionId, maxPoints) {
    currentSubmissionId = submissionId;
    document.getElementById('maxPointsDisplay').textContent = maxPoints;
    document.getElementById('gradeModal').style.display = 'block';
}

function closeGradeModal() {
    document.getElementById('gradeModal').style.display = 'none';
}

async function handleGradeSubmit(event) {
    event.preventDefault();
    const grade = parseInt(document.getElementById('submissionGrade').value, 10);
    const feedback = document.getElementById('submissionFeedback').value.trim();

    if (!grade && grade !== 0) {
        alert('Please enter a valid grade');
        return;
    }

    try {
        const { data, error } = await window.supabase.from('grades').insert([{
            submission_id: currentSubmissionId,
            grade,
            feedback
        }]);
        if (error) throw error;
        closeGradeModal();
        loadRecentSubmissions();
    } catch (err) {
        console.error('Error grading submission:', err);
        alert('Failed to save grade. Check console.');
    }
}
window.handleGradeSubmit = handleGradeSubmit;

// --------------------
// Assignment Management Functions
// --------------------
async function viewAssignmentSubmissions(assignmentId) {
    try {
        const { data: submissions, error } = await window.supabase
            .from('submissions')
            .select(`
                *,
                profiles!submissions_student_id_fkey(full_name),
                grades(points, feedback, graded_at)
            `)
            .eq('assignment_id', assignmentId);
        
        if (error) throw error;
        
        if (submissions.length === 0) {
            window.utils.showNotification('No submissions yet for this assignment', 'info');
            return;
        }
        
        // For now, show a simple alert with submission count
        // In a full implementation, this would open a detailed view
        window.utils.showNotification(`Found ${submissions.length} submission(s) for this assignment`, 'info');
        console.log('Submissions:', submissions);
        
    } catch (error) {
        console.error('Error loading submissions:', error);
        window.utils.showNotification('Failed to load submissions', 'error');
    }
}

function editAssignment(assignmentId) {
    // Placeholder for edit functionality
    window.utils.showNotification('Edit assignment feature coming soon!', 'info');
    console.log('Edit assignment:', assignmentId);
}

// --------------------
// Resource Functions
// --------------------
async function viewResource(resourceId) {
    try {
        const { data: resource, error } = await window.supabase
            .from('resources')
            .select('*')
            .eq('id', resourceId)
            .single();
        
        if (error) throw error;
        
        if (resource.file_url) {
            // Open the resource file in a new tab
            window.open(resource.file_url, '_blank');
        } else {
            window.utils.showNotification('File URL not available for this resource', 'warning');
        }
    } catch (error) {
        console.error('Error viewing resource:', error);
        window.utils.showNotification('Failed to open resource', 'error');
    }
}

async function approveResource(resourceId) {
    try {
        // This could be used to feature/approve resources or add to a recommended list
        window.utils.showNotification('Resource featured! (Feature can be expanded)', 'success');
        
        // Could add functionality to:
        // - Mark resource as "featured" in database
        // - Add to a recommended resources list
        // - Increase visibility in student feeds
        
    } catch (error) {
        console.error('Error featuring resource:', error);
        window.utils.showNotification('Failed to feature resource', 'error');
    }
}

// --------------------
// Event Listeners
// --------------------
function initializeEventListeners() {
    window.addEventListener('click', event => {
        ['createClassModal', 'createAssignmentModal', 'gradeModal'].forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (event.target === modal) modal.style.display = 'none';
        });
    });
}

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
    
    // Load additional sections
    await loadTeacherFlashcards();
    await loadTeacherResources();
    
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
    // hide all sections
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(sectionName);
    if (sec) sec.classList.add('active');

    // activate nav by data-section
    document.querySelectorAll('.sidebar .nav-item, .sidebar-nav .nav-item').forEach(n => {
        const ds = n.getAttribute('data-section');
        n.classList.toggle('active', ds === sectionName);
    });

    currentSection = sectionName;

    switch(sectionName) {
        case 'classes': loadClasses(); break;
        case 'assignments': loadAssignments(); break;
        case 'submissions': loadSubmissions('pending'); break;
        case 'resources': loadTeacherResources(); break;
        case 'flashcards': loadTeacherFlashcards(); break;
        case 'grades': loadGradesManagement(); break;
    }
}

// expose globally for inline onclick
window.showSection = showSection;

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
            <div class="class-card" onclick="openClassPage('${c.id}')">
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
                <div class="assignment-actions" onclick="event.stopPropagation()">
                    <button class="btn-secondary btn-small" onclick="openRosterModal('${c.id}', '${c.name.replace(/'/g, "\\'")}')">View Roster</button>
                    <button class="btn-secondary btn-small" onclick="navigator.clipboard.writeText('${c.class_code}').then(()=>window.utils.showNotification('Class code copied!','success'))">Copy Code</button>
                    <a class="btn-primary btn-small" href="class.html?class_id=${c.id}" onclick="event.stopPropagation()">Open Class</a>
                    <button class="btn-danger btn-small" onclick="event.stopPropagation(); deleteClass('${c.id}')">Delete Class</button>
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
                    <button class="btn-danger btn-small" onclick="deleteAssignment('${a.id}')">Delete</button>
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
        await loadFlashcardSetsForAssignment();
    }
}

function closeCreateAssignmentModal() { 
    const modal = document.getElementById('createAssignmentModal');
    if (modal) {
        modal.style.display = 'none';
        const form = modal.querySelector('form');
        if (form) form.reset();
        document.getElementById('flashcardSetGroup').style.display = 'none';
    }
}

function toggleFlashcardSelector() {
    const typeSelect = document.getElementById('assignmentType');
    const flashcardGroup = document.getElementById('flashcardSetGroup');
    if (typeSelect.value === 'flashcard') {
        flashcardGroup.style.display = 'block';
    } else {
        flashcardGroup.style.display = 'none';
    }
}
window.toggleFlashcardSelector = toggleFlashcardSelector;

async function loadFlashcardSetsForAssignment() {
    try {
        const teacherId = window.appState.currentUser.id;
        const { data: sets, error } = await window.supabase
            .from('flashcard_sets')
            .select('id, name')
            .eq('user_id', teacherId);
        
        if (error) throw error;
        
        const setSelect = document.getElementById('assignmentFlashcardSet');
        if (setSelect) {
            setSelect.innerHTML = '<option value="">Select Flashcard Set</option>' +
                (sets || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading flashcard sets:', error);
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
    const assignmentType = document.getElementById('assignmentType').value;
    const description = document.getElementById('assignmentDescription').value.trim();
    const dueDate = document.getElementById('assignmentDueDate').value;
    const maxPoints = parseInt(document.getElementById('assignmentMaxPoints').value, 10);
    const teacherId = window.appState.currentUser.id;

    if (!title || !classId || !assignmentType || !description || !dueDate || !maxPoints) {
        window.utils.showNotification('Please fill all required fields.', 'error');
        return;
    }

    if (assignmentType === 'flashcard') {
        const flashcardSetId = document.getElementById('assignmentFlashcardSet').value;
        if (!flashcardSetId) {
            window.utils.showNotification('Please select a flashcard set for flashcard assignments.', 'error');
            return;
        }
    }

    try {
        const { data: assignment, error } = await window.supabase
            .from('assignments')
            .insert([{
                title,
                class_id: classId,
                teacher_id: teacherId,
                description,
                due_date: dueDate,
                max_points: maxPoints,
                is_published: true
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        // If flashcard assignment, create the link
        if (assignmentType === 'flashcard') {
            const flashcardSetId = document.getElementById('assignmentFlashcardSet').value;
            const { error: linkError } = await window.supabase
                .from('flashcard_assignment_links')
                .insert([{
                    assignment_id: assignment.id,
                    flashcard_set_id: flashcardSetId
                }]);
            if (linkError) throw linkError;
        }
        
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
    const pointsRaw = document.getElementById('submissionGrade').value;
    const points = parseFloat(pointsRaw);
    const feedback = document.getElementById('submissionFeedback').value.trim();

    if (isNaN(points) || points < 0) {
        alert('Please enter a valid grade');
        return;
    }

    try {
        const teacherId = window.appState.currentUser.id;
        const { error } = await window.supabase.from('grades').insert([{
            submission_id: currentSubmissionId,
            teacher_id: teacherId,
            points,
            feedback
        }]);
        if (error) throw error;
        closeGradeModal();
        await loadRecentSubmissions();
        if (currentSection === 'submissions') await loadSubmissions('pending');
        window.utils.showNotification('Grade saved', 'success');
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
                id, submitted_at, file_url, file_name, content,
                profiles!submissions_student_id_fkey(full_name),
                grades(points, feedback, graded_at),
                assignments!inner(title, max_points)
            `)
            .eq('assignment_id', assignmentId);
        
        if (error) throw error;
        
        if (!submissions || submissions.length === 0) {
            window.utils.showNotification('No submissions yet for this assignment', 'info');
            return;
        }

        const maxPoints = submissions[0]?.assignments?.max_points || 100;
        const container = document.getElementById('submissionsList');
        container.innerHTML = submissions.map(s => `
            <div class="assignment-card">
                <div class="assignment-header">
                    <div>
                        <h3 class="assignment-title">${s.profiles.full_name}</h3>
                        <div class="assignment-meta">
                            Submitted: ${window.utils.formatDateTime(s.submitted_at)}
                        </div>
                    </div>
                    <div class="assignment-status ${s.grades && s.grades.length > 0 ? 'status-graded' : 'status-submitted'}">
                        ${s.grades && s.grades.length > 0 ? 'Graded' : 'Submitted'}
                    </div>
                </div>
                <div class="assignment-actions">
                    ${s.file_url ? `<a class=\"btn-secondary btn-small\" target=\"_blank\" href=\"${s.file_url}\">Open File</a>` : ''}
                    <button class="btn-primary btn-small" onclick="showGradeModal('${s.id}', ${maxPoints})">${s.grades && s.grades.length > 0 ? 'Update Grade' : 'Grade'}</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading assignment submissions:', error);
        window.utils.showNotification('Failed to load submissions', 'error');
    }
}

async function loadSubmissions(status = 'pending') {
    try {
        if (!window.appState || !window.appState.currentUser) return;
        const teacherId = window.appState.currentUser.id;
        let query = window.supabase
            .from('submissions')
            .select(`
                id, submitted_at, file_url, file_name, content,
                profiles(full_name),
                assignments!inner(id, title, max_points, teacher_id),
                grades(id, points)
            `)
            .eq('assignments.teacher_id', teacherId)
            .order('submitted_at', { ascending: false });
        if (status === 'pending') {
            query = query.is('grades', null);
        } else if (status === 'graded') {
            query = query.not('grades', 'is', null);
        }
        const { data, error } = await query;
        if (error) throw error;
        const container = document.getElementById('submissionsList');
        if (!data || data.length === 0) {
            window.utils.showEmptyState(container, status === 'pending' ? 'No pending submissions' : 'No graded submissions', '');
            return;
        }
        container.innerHTML = data.map(s => `
            <div class="assignment-card">
                <div class="assignment-header">
                    <div>
                        <h3 class="assignment-title">${s.profiles.full_name} — ${s.assignments.title}</h3>
                        <div class="assignment-meta">Submitted: ${window.utils.formatDateTime(s.submitted_at)}</div>
                    </div>
                    <div class="assignment-status ${s.grades && s.grades.length > 0 ? 'status-graded' : 'status-submitted'}">
                        ${s.grades && s.grades.length > 0 ? `Graded (${s.grades[0].points}/${s.assignments.max_points})` : 'Submitted'}
                    </div>
                </div>
                <div class="assignment-actions">
                    ${s.file_url ? `<a class=\"btn-secondary btn-small\" target=\"_blank\" href=\"${s.file_url}\">Open File</a>` : ''}
                    <button class="btn-primary btn-small" onclick="showGradeModal('${s.id}', ${s.assignments.max_points})">${s.grades && s.grades.length > 0 ? 'Update Grade' : 'Grade'}</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading submissions:', err);
        window.utils.showNotification('Failed to load submissions', 'error');
    }
}
window.loadSubmissions = loadSubmissions;
function showSubmissions(status) {
    document.querySelectorAll('#submissions .tab-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    loadSubmissions(status);
}
window.showSubmissions = showSubmissions;

async function loadGradesManagement() {
    try {
        if (!window.appState || !window.appState.currentUser) return;
        const teacherId = window.appState.currentUser.id;
        const [classesRes, assignmentsRes] = await Promise.all([
            window.supabase.from('classes').select('id, name').eq('teacher_id', teacherId),
            window.supabase.from('assignments').select('id, title, class_id').eq('teacher_id', teacherId)
        ]);
        const classSel = document.getElementById('classFilterGrades');
        const assignmentSel = document.getElementById('assignmentFilterGrades');
        classSel.innerHTML = '<option value="">All Classes</option>' + (classesRes.data||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
        assignmentSel.innerHTML = '<option value="">All Assignments</option>' + (assignmentsRes.data||[]).map(a=>`<option data-class="${a.class_id}" value="${a.id}">${a.title}</option>`).join('');
        document.getElementById('gradesTable').innerHTML = '<div class="empty-state"><h3>Select a class and an assignment to view grades</h3></div>';
    } catch (err) {
        console.error('Error loading grades management:', err);
    }
}
window.loadGradesManagement = loadGradesManagement;

async function filterGrades() {
    try {
        const classSel = document.getElementById('classFilterGrades');
        const assignmentSel = document.getElementById('assignmentFilterGrades');
        const classId = classSel.value;
        const assignmentId = assignmentSel.value;
        Array.from(assignmentSel.options).forEach(opt => {
            if (!opt.value) return;
            const match = !classId || opt.getAttribute('data-class') === classId;
            opt.style.display = match ? '' : 'none';
        });
        if (!classId || !assignmentId) {
            document.getElementById('gradesTable').innerHTML = '<div class="empty-state"><h3>Select a class and an assignment to view grades</h3></div>';
            return;
        }
        const [enrollmentsRes, submissionsRes] = await Promise.all([
            window.supabase.from('class_enrollments').select('student_id, profiles(full_name)').eq('class_id', classId),
            window.supabase.from('submissions').select('id, student_id, grades(points, feedback)').eq('assignment_id', assignmentId)
        ]);
        const submissionsByStudent = new Map((submissionsRes.data||[]).map(s => [s.student_id, s]));
        const rows = (enrollmentsRes.data||[]).map(en => {
            const sub = submissionsByStudent.get(en.student_id);
            const graded = sub && sub.grades && sub.grades.length > 0;
            const points = graded ? sub.grades[0].points : '-';
            const action = graded ? '<span class="status-graded">Graded</span>' : (sub ? `<button class=\"btn-primary btn-small\" onclick=\"showGradeModal('${sub.id}', 100)\">Grade</button>` : '<span class=\"status-pending\">No submission</span>');
            return `<tr><td>${en.profiles.full_name}</td><td>${points}</td><td>${action}</td></tr>`;
        });
        document.getElementById('gradesTable').innerHTML = `
            <table class="table">
                <thead><tr><th>Student</th><th>Points</th><th>Action</th></tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        `;
    } catch (err) {
        console.error('Error filtering grades:', err);
        window.utils.showNotification('Failed to load grades', 'error');
    }
}
window.filterGrades = filterGrades;

function editAssignment(assignmentId) {
    // Placeholder for edit functionality
    window.utils.showNotification('Edit assignment is disabled.', 'info');
    console.log('Edit assignment:', assignmentId);
}

// --------------------
// Roster Functions
// --------------------
async function openRosterModal(classId, className) {
    try {
        const { data: enrollments, error } = await window.supabase
            .from('class_enrollments')
            .select('profiles(full_name, email), enrolled_at')
            .eq('class_id', classId)
            .order('enrolled_at', { ascending: false });
        if (error) throw error;
        document.getElementById('rosterModalTitle').textContent = `Class Roster — ${className}`;
        const list = document.getElementById('rosterList');
        if (!enrollments || enrollments.length === 0) {
            list.innerHTML = '<div class="empty-state"><h3>No students enrolled yet</h3></div>';
        } else {
            list.innerHTML = `
                <table class="table">
                    <thead><tr><th>Name</th><th>Email</th><th>Enrolled</th></tr></thead>
                    <tbody>
                        ${enrollments.map(e => `<tr><td>${e.profiles.full_name}</td><td>${e.profiles.email||'-'}</td><td>${window.utils.formatDateTime(e.enrolled_at)}</td></tr>`).join('')}
                    </tbody>
                </table>
            `;
        }
        document.getElementById('rosterModal').style.display = 'block';
    } catch (err) {
        console.error('Error loading roster:', err);
        window.utils.showNotification('Failed to load roster', 'error');
    }
}
function closeRosterModal() {
    const modal = document.getElementById('rosterModal');
    if (modal) modal.style.display = 'none';
}
window.openRosterModal = openRosterModal;
window.closeRosterModal = closeRosterModal;

// --------------------
// Grade Items Functions
// --------------------
async function showManageGradeItemsModal() {
    try {
        const modal = document.getElementById('gradeItemsModal');
        modal.style.display = 'block';
        await loadClassesForGradeItems();
        await loadGradeItemsList();
        showGradeItemsTab('list');
    } catch (err) {
        console.error('Error opening grade items modal:', err);
    }
}

function closeGradeItemsModal() {
    const modal = document.getElementById('gradeItemsModal');
    if (modal) modal.style.display = 'none';
}

function showGradeItemsTab(tab) {
    document.querySelectorAll('#gradeItemsModal .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (tab === 'list') {
        document.querySelector('#gradeItemsModal .tab-btn').classList.add('active');
        document.getElementById('gradeItemsList').style.display = 'block';
        document.getElementById('gradeItemsCreate').style.display = 'none';
    } else {
        document.querySelectorAll('#gradeItemsModal .tab-btn')[1].classList.add('active');
        document.getElementById('gradeItemsList').style.display = 'none';
        document.getElementById('gradeItemsCreate').style.display = 'block';
    }
}

async function loadClassesForGradeItems() {
    try {
        const teacherId = window.appState.currentUser.id;
        const { data: classes, error } = await window.supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', teacherId);
        
        if (error) throw error;
        
        const classSelect = document.getElementById('gradeItemClass');
        classSelect.innerHTML = '<option value="">Select Class</option>' +
            (classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading classes for grade items:', error);
    }
}

async function loadGradeItemsList() {
    try {
        const teacherId = window.appState.currentUser.id;
        const { data: gradeItems, error } = await window.supabase
            .from('grade_items')
            .select(`
                *,
                classes!inner(name, teacher_id)
            `)
            .eq('classes.teacher_id', teacherId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('gradeItemsList');
        if (!gradeItems || gradeItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No grade items created</h3><p>Create grade items to track final marks for your classes.</p></div>';
            return;
        }
        
        container.innerHTML = gradeItems.map(item => `
            <div class="grade-item-card">
                <div class="grade-item-header">
                    <div>
                        <h4>${item.name}</h4>
                        <p>${item.classes.name} • Max Points: ${item.max_points}${item.weight ? ` • Weight: ${item.weight}%` : ''}</p>
                    </div>
                    <div class="grade-item-actions">
                        <button class="btn-secondary btn-small" onclick="manageGradeItemScores('${item.id}', '${item.name}', ${item.max_points})">Grade Students</button>
                        <button class="btn-primary btn-small" onclick="toggleGradeItemVisibility('${item.id}', ${item.visible})">${item.visible ? 'Hide' : 'Show'}</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading grade items:', error);
    }
}

async function handleCreateGradeItem(event) {
    event.preventDefault();
    
    try {
        const classId = document.getElementById('gradeItemClass').value;
        const name = document.getElementById('gradeItemName').value.trim();
        const maxPoints = parseFloat(document.getElementById('gradeItemMaxPoints').value);
        const weight = document.getElementById('gradeItemWeight').value.trim();
        
        if (!classId || !name || !maxPoints) {
            window.utils.showNotification('Please fill all required fields', 'error');
            return;
        }
        
        const gradeItem = {
            class_id: classId,
            name,
            max_points: maxPoints,
            visible: true
        };
        
        if (weight) {
            gradeItem.weight = parseFloat(weight);
        }
        
        const { error } = await window.supabase
            .from('grade_items')
            .insert([gradeItem]);
        
        if (error) throw error;
        
        window.utils.showNotification('Grade item created successfully!', 'success');
        document.querySelector('#gradeItemsCreate form').reset();
        await loadGradeItemsList();
        showGradeItemsTab('list');
    } catch (error) {
        console.error('Error creating grade item:', error);
        window.utils.showNotification(`Failed to create grade item: ${error.message}`, 'error');
    }
}

async function toggleGradeItemVisibility(gradeItemId, currentVisibility) {
    try {
        const { error } = await window.supabase
            .from('grade_items')
            .update({ visible: !currentVisibility })
            .eq('id', gradeItemId);
        
        if (error) throw error;
        
        window.utils.showNotification(`Grade item ${!currentVisibility ? 'shown' : 'hidden'} to students`, 'success');
        await loadGradeItemsList();
    } catch (error) {
        console.error('Error toggling grade item visibility:', error);
        window.utils.showNotification('Failed to update visibility', 'error');
    }
}

window.showManageGradeItemsModal = showManageGradeItemsModal;
window.closeGradeItemsModal = closeGradeItemsModal;
window.showGradeItemsTab = showGradeItemsTab;
window.handleCreateGradeItem = handleCreateGradeItem;
window.toggleGradeItemVisibility = toggleGradeItemVisibility;

// Placeholder for grade item scoring (individual student marks entry)
function manageGradeItemScores(gradeItemId, gradeItemName, maxPoints) {
    // This would open a modal to enter individual student scores for this grade item
    // Similar to the grades table but for final marks
    window.utils.showNotification(`Grade item scoring for "${gradeItemName}" - Feature available in full version`, 'info');
    console.log('Grade item scores management:', { gradeItemId, gradeItemName, maxPoints });
}
window.manageGradeItemScores = manageGradeItemScores;

// --------------------
// Teacher Flashcards Functions
// --------------------
async function loadTeacherFlashcards() {
    try {
        if (!window.appState || !window.appState.currentUser) return;
        const teacherId = window.appState.currentUser.id;
        
        const { data: sets, error } = await window.supabase
            .from('flashcard_sets')
            .select('*')
            .eq('user_id', teacherId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('flashcardSets');
        if (!sets || sets.length === 0) {
            window.utils.showEmptyState(container, 'No flashcard sets', 'Create flashcard sets to use in assignments');
            return;
        }

        container.innerHTML = sets.map(set => `
            <div class="flashcard-set-card">
                <h3>${set.name}</h3>
                <p>${set.subject || 'General'}</p>
                <div class="flashcard-count">${set.card_count || 0} cards</div>
                <div class="card-actions">
                    <button class="btn-secondary btn-small" onclick="openTeacherFlashcardSet('${set.id}')">View</button>
                    <button class="btn-danger btn-small" onclick="deleteFlashcardSet('${set.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading flashcard sets:', error);
    }
}

function showCreateFlashcardModal() {
    const modal = document.getElementById('createFlashcardModal');
    if (modal) modal.style.display = 'block';
}

function closeCreateFlashcardModal() {
    const modal = document.getElementById('createFlashcardModal');
    if (modal) {
        modal.style.display = 'none';
        const form = modal.querySelector('form');
        if (form) form.reset();
        // Reset to single card
        const inputs = document.getElementById('flashcardInputs');
        inputs.innerHTML = `
            <div class="flashcard-input-pair">
                <div class="form-group">
                    <label>Question 1</label>
                    <textarea class="flashcard-question" required></textarea>
                </div>
                <div class="form-group">
                    <label>Answer 1</label>
                    <textarea class="flashcard-answer" required></textarea>
                </div>
            </div>
        `;
    }
}

function addFlashcardInput() {
    const container = document.getElementById('flashcardInputs');
    const currentCount = container.querySelectorAll('.flashcard-input-pair').length;
    const newIndex = currentCount + 1;
    
    const newPair = document.createElement('div');
    newPair.className = 'flashcard-input-pair';
    newPair.innerHTML = `
        <div class="form-group">
            <label>Question ${newIndex}</label>
            <textarea class="flashcard-question" required></textarea>
        </div>
        <div class="form-group">
            <label>Answer ${newIndex}</label>
            <textarea class="flashcard-answer" required></textarea>
        </div>
    `;
    
    container.appendChild(newPair);
}

async function handleCreateFlashcardSet(event) {
    event.preventDefault();
    
    try {
        const teacherId = window.appState.currentUser.id;
        const name = document.getElementById('flashcardSetName').value.trim();
        const subject = document.getElementById('flashcardSubject').value.trim();
        
        const questions = document.querySelectorAll('.flashcard-question');
        const answers = document.querySelectorAll('.flashcard-answer');
        
        if (!name || questions.length === 0) {
            window.utils.showNotification('Please fill in the set name and at least one card', 'error');
            return;
        }
        
        // Validate all cards have content
        const cards = [];
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i].value.trim();
            const answer = answers[i].value.trim();
            
            if (!question || !answer) {
                window.utils.showNotification(`Please fill in both question and answer for card ${i + 1}`, 'error');
                return;
            }
            
            cards.push({ question, answer, order_index: i });
        }
        
        // Create flashcard set
        const { data: set, error: setError } = await window.supabase
            .from('flashcard_sets')
            .insert([{
                user_id: teacherId,
                name: name,
                subject: subject,
                card_count: cards.length
            }])
            .select()
            .single();
            
        if (setError) throw setError;
        
        // Create flashcards
        const flashcards = cards.map(card => ({
            set_id: set.id,
            question: card.question,
            answer: card.answer,
            order_index: card.order_index
        }));
        
        const { error: cardsError } = await window.supabase
            .from('flashcards')
            .insert(flashcards);
            
        if (cardsError) throw cardsError;
        
        window.utils.showNotification('Flashcard set created successfully!', 'success');
        closeCreateFlashcardModal();
        await loadTeacherFlashcards();
        await loadDashboardData();
    } catch (error) {
        console.error('Error creating flashcard set:', error);
        window.utils.showNotification(`Failed to create flashcard set: ${error.message}`, 'error');
    }
}

function editFlashcardSet(setId) {
    window.utils.showNotification('Flashcard editing feature coming soon!', 'info');
    console.log('Edit flashcard set:', setId);
}

window.loadTeacherFlashcards = loadTeacherFlashcards;
window.showCreateFlashcardModal = showCreateFlashcardModal;
window.closeCreateFlashcardModal = closeCreateFlashcardModal;
window.addFlashcardInput = addFlashcardInput;
window.handleCreateFlashcardSet = handleCreateFlashcardSet;
window.editFlashcardSet = editFlashcardSet;
window.openTeacherFlashcardSet = openTeacherFlashcardSet;
window.closeTeacherFlashcardViewer = closeTeacherFlashcardViewer;
window.teacherNextCard = teacherNextCard;
window.teacherPrevCard = teacherPrevCard;
window.teacherFlipCard = teacherFlipCard;
window.deleteFlashcardSet = deleteFlashcardSet;

// --------------------
// Teacher Flashcard Viewer Functions
// --------------------
let tFlashcards = [];
let tCardIndex = 0;

async function openTeacherFlashcardSet(setId){
    try {
        const { data: cards, error } = await window.supabase
            .from('flashcards')
            .select('*')
            .eq('set_id', setId)
            .order('order_index');
        if (error) throw error;
        if (!cards || cards.length === 0) {
            window.utils.showNotification('No cards in this set', 'warning');
            return;
        }
        tFlashcards = cards;
        tCardIndex = 0;
        updateTeacherFlashcardView();
        document.getElementById('flashcardViewerModal').style.display = 'block';
    } catch (e) {
        console.error(e);
        window.utils.showNotification('Failed to open flashcards', 'error');
    }
}

function updateTeacherFlashcardView(){
    const q = document.getElementById('teacherCardQuestion');
    const a = document.getElementById('teacherCardAnswer');
    const c = document.getElementById('teacherCardCounter');
    const card = tFlashcards[tCardIndex];
    if (q) q.textContent = card.question;
    if (a) a.textContent = card.answer;
    if (c) c.textContent = `${tCardIndex + 1} / ${tFlashcards.length}`;
    const fc = document.querySelector('#flashcardViewerModal .flashcard');
    if (fc) fc.classList.remove('flipped');
}

function teacherNextCard(){
    if (tCardIndex < tFlashcards.length - 1) {
        tCardIndex++;
        updateTeacherFlashcardView();
    }
}
function teacherPrevCard(){
    if (tCardIndex > 0) {
        tCardIndex--;
        updateTeacherFlashcardView();
    }
}
function teacherFlipCard(){
    const fc = document.querySelector('#flashcardViewerModal .flashcard');
    if (fc) fc.classList.toggle('flipped');
}
function closeTeacherFlashcardViewer(){
    document.getElementById('flashcardViewerModal').style.display = 'none';
}

async function deleteFlashcardSet(setId){
    if (!confirm('Delete this flashcard set and its cards?')) return;
    try {
        // Delete cards first (ON DELETE CASCADE recommended, but doing explicit for safety)
        await window.supabase.from('flashcards').delete().eq('set_id', setId);
        const { error } = await window.supabase.from('flashcard_sets').delete().eq('id', setId);
        if (error) throw error;
        window.utils.showNotification('Flashcard set deleted','success');
        await loadTeacherFlashcards();
    } catch (e) {
        console.error(e);
        window.utils.showNotification('Failed to delete set','error');
    }
}

// --------------------
// Teacher Resources Functions
// --------------------
async function loadTeacherResources() {
    try {
        if (!window.appState || !window.appState.currentUser) return;
        const teacherId = window.appState.currentUser.id;
        
        // First, get all classes for this teacher
        const { data: classes, error: classesError } = await window.supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', teacherId);
            
        if (classesError) {
            console.error('Error loading classes:', classesError);
            throw classesError;
        }
        
        if (!classes || classes.length === 0) {
            const grid = document.getElementById('resourcesGrid');
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>No classes found</h3>
                    <p>Create a class first to upload resources</p>
                </div>
            `;
            return;
        }
        
        const classIds = classes.map(c => c.id);
        
        // Get resources for these classes
        const { data: resources, error } = await window.supabase
            .from('class_resources')
            .select(`
                *,
                resources!inner(*),
                classes!inner(name)
            `)
            .in('class_id', classIds)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading resources:', error);
            throw error;
        }

        displayTeacherResources(resources || []);
    } catch (error) {
        console.error('Error loading teacher resources:', error);
        const grid = document.getElementById('resourcesGrid');
        grid.innerHTML = `
            <div class="empty-state">
                <h3>Error loading resources</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function displayTeacherResources(classResources) {
    const grid = document.getElementById('resourcesGrid');
    
    if (classResources.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No class resources</h3>
                <p>Upload resources to share with your students</p>
                <button class="btn-primary" onclick="showUploadResourceModal()">Upload Resource</button>
            </div>
        `;
        return;
    }
    const teacherId = window.appState?.currentUser?.id;
    
    grid.innerHTML = classResources.map(classRes => {
        const resource = classRes.resources;
        const canDeleteResource = resource.user_id === teacherId;
        return `
            <div class="resource-card">
                <div class="resource-header">
                    <h3>${resource.title}</h3>
                    <div class="resource-meta">
                        <span>Class: ${classRes.classes.name}</span>
                        <span class="resource-type">${resource.resource_type}</span>
                        ${classRes.featured ? '<span class="featured-badge">★ Featured</span>' : ''}
                    </div>
                </div>
                <div class="resource-body">
                    <div class="resource-description">
                        ${resource.description || 'No description available'}
                    </div>
                    <div class="resource-actions">
                        <button class="btn-secondary btn-small" onclick="viewResource('${resource.id}')">View</button>
                        <button class="btn-primary btn-small" onclick="toggleResourceFeatured('${classRes.id}', ${classRes.featured})">${classRes.featured ? 'Unfeature' : 'Feature'}</button>
                        <button class="btn-warning btn-small" onclick="removeResourceFromClass('${classRes.id}')">Remove from Class</button>
                        ${canDeleteResource ? `<button class="btn-danger btn-small" onclick="deleteResource('${resource.id}')">Delete Resource</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showUploadResourceModal() {
    const modal = document.getElementById('uploadResourceModal');
    if (modal) {
        modal.style.display = 'block';
        loadClassesForResource();
    }
}

function closeUploadResourceModal() {
    const modal = document.getElementById('uploadResourceModal');
    if (modal) {
        modal.style.display = 'none';
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

async function loadClassesForResource() {
    try {
        const teacherId = window.appState.currentUser.id;
        const { data: classes, error } = await window.supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', teacherId);
        
        if (error) throw error;
        
        const classSelect = document.getElementById('resourceClass');
        classSelect.innerHTML = '<option value="">Select Class</option>' +
            (classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading classes for resource:', error);
    }
}

async function handleResourceUpload(event) {
    event.preventDefault();
    
    try {
        const teacherId = window.appState.currentUser.id;
        const title = document.getElementById('resourceTitle').value.trim();
        const classId = document.getElementById('resourceClass').value;
        const subject = document.getElementById('resourceSubject').value.trim();
        const type = document.getElementById('resourceType').value;
        const description = document.getElementById('resourceDescription').value.trim();
        const fileInput = document.getElementById('resourceFile');
        const file = fileInput.files[0];
        
        if (!title || !classId || !type || !file) {
            window.utils.showNotification('Please fill all required fields and select a file', 'error');
            return;
        }
        
        // Upload file to submissions bucket (temporary workaround)
        const fileExt = file.name.split('.').pop();
        const fileName = `class-resources/${teacherId}/${Date.now()}.${fileExt}`;
        
const { data: uploadData, error: uploadError } = await window.supabase.storage
            .from('resources')
            .upload(fileName, file);
            
        if (uploadError) throw uploadError;
        
const { data: urlData } = window.supabase.storage.from('resources').getPublicUrl(fileName);
        
        // Create resource
        const { data: resource, error: resourceError } = await window.supabase
            .from('resources')
            .insert([{
                user_id: teacherId,
                title,
                description,
                resource_type: type,
                file_url: urlData.publicUrl,
                file_name: file.name,
                file_size: file.size,
                is_public: false // Class resources are not globally public
            }])
            .select()
            .single();
            
        if (resourceError) throw resourceError;
        
        // Link to class
        const { error: classLinkError } = await window.supabase
            .from('class_resources')
            .insert([{
                class_id: classId,
                resource_id: resource.id,
                created_by: teacherId
            }]);
            
        if (classLinkError) throw classLinkError;
        
        window.utils.showNotification('Resource uploaded successfully!', 'success');
        closeUploadResourceModal();
        await loadTeacherResources();
    } catch (error) {
        console.error('Error uploading resource:', error);
        window.utils.showNotification(`Failed to upload resource: ${error.message}`, 'error');
    }
}

async function toggleResourceFeatured(classResourceId, currentFeatured) {
    try {
        const { error } = await window.supabase
            .from('class_resources')
            .update({ featured: !currentFeatured })
            .eq('id', classResourceId);
            
        if (error) throw error;
        
        window.utils.showNotification(`Resource ${!currentFeatured ? 'featured' : 'unfeatured'}`, 'success');
        await loadTeacherResources();
    } catch (error) {
        console.error('Error toggling resource featured status:', error);
        window.utils.showNotification('Failed to update resource', 'error');
    }
}

window.loadTeacherResources = loadTeacherResources;
window.showUploadResourceModal = showUploadResourceModal;
window.closeUploadResourceModal = closeUploadResourceModal;
window.handleResourceUpload = handleResourceUpload;
window.toggleResourceFeatured = toggleResourceFeatured;

// Global function to view a resource
function viewResource(resourceId) {
    // This will open the resource in a new tab/window
    // You can enhance this to show in a modal or preview
    window.supabase
        .from('resources')
        .select('file_url, title')
        .eq('id', resourceId)
        .single()
        .then(({ data, error }) => {
            if (error) {
                console.error('Error fetching resource:', error);
                window.utils.showNotification('Failed to load resource', 'error');
                return;
            }
            if (data && data.file_url) {
                const modal = document.getElementById('resourcePreviewModal');
                const iframe = document.getElementById('resourcePreviewFrame');
                if (modal && iframe) {
                    iframe.src = data.file_url;
                    modal.style.display = 'block';
                } else {
                    window.open(data.file_url, '_blank');
                }
            }
        });
}

window.viewResource = viewResource;
window.deleteClass = deleteClass;
window.deleteAssignment = deleteAssignment;
window.removeResourceFromClass = removeResourceFromClass;
window.deleteResource = deleteResource;

function openClassPage(id){
    window.location.href = `class.html?class_id=${id}`;
}

// --------------------
// Resource Functions
// --------------------

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
async function deleteClass(classId){
    if (!confirm('Delete this class? This cannot be undone.')) return;
    try {
        const { error } = await window.supabase.from('classes').delete().eq('id', classId);
        if (error) throw error;
        window.utils.showNotification('Class deleted','success');
        await loadClasses();
        await loadDashboardData();
    } catch (e) { console.error(e); window.utils.showNotification('Failed to delete class','error'); }
}

async function deleteAssignment(assignmentId){
    if (!confirm('Delete this assignment? This will remove submissions too.')) return;
    try {
        const { error } = await window.supabase.from('assignments').delete().eq('id', assignmentId);
        if (error) throw error;
        window.utils.showNotification('Assignment deleted','success');
        await loadAssignments();
        await loadDashboardData();
    } catch (e) { console.error(e); window.utils.showNotification('Failed to delete assignment','error'); }
}

async function removeResourceFromClass(classResourceId){
    if (!confirm('Remove this resource from the class?')) return;
    try {
        const { error } = await window.supabase.from('class_resources').delete().eq('id', classResourceId);
        if (error) throw error;
        window.utils.showNotification('Resource removed from class','success');
        await loadTeacherResources();
    } catch (e) { console.error(e); window.utils.showNotification('Failed to remove resource','error'); }
}

async function deleteResource(resourceId){
    if (!confirm('Permanently delete this resource?')) return;
    try {
        const { error } = await window.supabase.from('resources').delete().eq('id', resourceId);
        if (error) throw error;
        window.utils.showNotification('Resource deleted','success');
        await loadTeacherResources();
    } catch (e) { console.error(e); window.utils.showNotification('Failed to delete resource (are you the owner?)','error'); }
}

function initializeEventListeners() {
    window.addEventListener('click', event => {
        ['createClassModal', 'createAssignmentModal', 'gradeModal', 'rosterModal', 'gradeItemsModal', 'uploadResourceModal'].forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (event.target === modal) modal.style.display = 'none';
        });
    });
}

// Logout function
async function logout() {
    try {
        await window.supabase.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
        window.location.href = 'index.html';
    }
}

// Global function exposures
window.showCreateClassModal = showCreateClassModal;
window.closeCreateClassModal = closeCreateClassModal;
window.handleCreateClass = handleCreateClass;
window.showCreateAssignmentModal = showCreateAssignmentModal;
window.closeCreateAssignmentModal = closeCreateAssignmentModal;
window.handleCreateAssignment = handleCreateAssignment;
window.showGradeModal = showGradeModal;
window.closeGradeModal = closeGradeModal;
window.handleGradeSubmit = handleGradeSubmit;
window.loadSubmissions = loadSubmissions;
window.showSubmissions = showSubmissions;
window.loadGradesManagement = loadGradesManagement;
window.filterGrades = filterGrades;
window.openRosterModal = openRosterModal;
window.closeRosterModal = closeRosterModal;
window.showCreateFlashcardModal = showCreateFlashcardModal;
window.closeCreateFlashcardModal = closeCreateFlashcardModal;
window.handleCreateFlashcardSet = handleCreateFlashcardSet;
window.addFlashcardInput = addFlashcardInput;
window.removeFlashcardInput = removeFlashcardInput;
window.openTeacherFlashcardSet = openTeacherFlashcardSet;
window.closeTeacherFlashcardViewer = closeTeacherFlashcardViewer;
window.teacherNextCard = teacherNextCard;
window.teacherPrevCard = teacherPrevCard;
window.teacherFlipCard = teacherFlipCard;
window.loadTeacherResources = loadTeacherResources;
window.showUploadResourceModal = showUploadResourceModal;
window.closeUploadResourceModal = closeUploadResourceModal;
window.handleResourceUpload = handleResourceUpload;
window.toggleResourceFeatured = toggleResourceFeatured;
window.viewResource = viewResource;
window.removeResourceFromClass = removeResourceFromClass;
window.deleteResource = deleteResource;
window.deleteClass = deleteClass;
window.deleteAssignment = deleteAssignment;
window.viewAssignmentSubmissions = viewAssignmentSubmissions;
window.toggleFlashcardSelector = toggleFlashcardSelector;
window.loadClasses = loadClasses;
window.loadAssignments = loadAssignments;
window.loadTeacherFlashcards = loadTeacherFlashcards;
window.deleteFlashcardSet = deleteFlashcardSet;
window.loadRecentSubmissions = loadRecentSubmissions;
window.loadDashboardData = loadDashboardData;
window.loadUserInfo = loadUserInfo;
window.showSection = showSection;
window.logout = logout;

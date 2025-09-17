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
        const teacherId = window.appState.currentUser.id;

        const [classes, assignments, submissions] = await Promise.all([
            window.supabase.from('teacher_classes').select('*'),
            window.supabase.from('teacher_assignments').select('id'),
            window.supabase.from('submissions')
                .select('id, assignments!inner(id, title, teacher_id), profiles(full_name), grades(id)')
                .eq('assignments.teacher_id', teacherId)
                .is('grades.id', null)
        ]);

        // Update stats
        document.getElementById('classCount').textContent = classes.data?.length || 0;
        document.getElementById('assignmentCount').textContent = assignments.data?.length || 0;
        document.getElementById('submissionCount').textContent = submissions.data?.length || 0;

        // Count unique students
        const uniqueStudents = new Set(classes.data?.flatMap(c => c.student_ids) || []);
        document.getElementById('studentCount').textContent = uniqueStudents.size;

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
        const { data: classes, error } = await window.supabase.from('teacher_classes').select('*');
        if (error) throw error;

        const container = document.getElementById('classesList');
        if (!classes || classes.length === 0) {
            window.utils.showEmptyState(container, 'No classes created', 'Create your first class to get started');
            return;
        }

        container.innerHTML = classes.map(c => `
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
                    <span>Students: ${c.student_ids.length}</span>
                    <span>Assignments: ${c.assignment_ids.length}</span>
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
        const { data: assignments, error } = await window.supabase
            .from('teacher_assignments')
            .select('*')
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
                    <h3>${a.title}</h3>
                    <div>Class: ${a.class_name} | Due: ${window.utils.formatDateTime(a.due_date)} | Points: ${a.max_points}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading assignments:', error);
    }
}

// --------------------
// Modal Handlers
// --------------------
function showCreateClassModal() { document.getElementById('createClassModal').style.display = 'block'; }
function closeCreateClassModal() { document.getElementById('createClassModal').style.display = 'none'; }

async function handleCreateClass(event) {
  event.preventDefault();

  try {
    const teacherId = window.appState.currentUser.id;
    const name = document.getElementById('className').value.trim();
    const subject = document.getElementById('classSubject').value.trim();
    const description = document.getElementById('classDescription').value.trim();
    const classCode = document.getElementById('classCode').value.trim();

    if (!name || !subject || !classCode) {
      window.utils.showNotification('Name, Subject, and Class Code are required.');
      return;
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
        alert('Please fill all required fields.');
        return;
    }

    try {
        const { data, error } = await window.supabase.from('teacher_assignments').insert([{
            title, class_id: classId, description, due_date: dueDate, max_points: maxPoints, teacher_id: teacherId
        }]);
        if (error) throw error;
        closeCreateAssignmentModal();
        loadAssignments();
    } catch (err) {
        console.error('Error creating assignment:', err);
        alert('Failed to create assignment. Check console.');
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

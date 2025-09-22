// ========================================
// MODERN TEACHER DASHBOARD
// ========================================

let currentSection = 'overview';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAuth();
        
        if (window.appState.userRole !== 'teacher') {
            window.location.href = 'dashboard-student-modern.html';
            return;
        }

        await loadUserInfo();
        await loadDashboardData();
        initializeEventListeners();
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        utils.showNotification('Failed to initialize dashboard', 'error');
    }
});

// ========================================
// USER INFO & AUTHENTICATION
// ========================================

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
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                    ${profile.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div class="text-sm font-medium">${profile.full_name}</div>
                    <div class="text-xs text-gray-500">Teacher</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// ========================================
// DASHBOARD DATA
// ========================================

async function loadDashboardData() {
    try {
        const teacherId = window.appState.currentUser.id;

        // Load all dashboard statistics
        const [classes, assignments, submissions] = await Promise.all([
            window.supabase.from('classes').select('*').eq('teacher_id', teacherId),
            window.supabase.from('assignments').select('id').eq('teacher_id', teacherId),
            window.supabase.from('submissions')
                .select(`
                    id, 
                    assignments!inner(id, title, teacher_id), 
                    profiles(full_name), 
                    grades(id)
                `)
                .eq('assignments.teacher_id', teacherId)
                .is('grades.id', null)
        ]);

        // Update statistics
        document.getElementById('classCount').textContent = classes.data?.length || 0;
        document.getElementById('assignmentCount').textContent = assignments.data?.length || 0;
        document.getElementById('submissionCount').textContent = submissions.data?.length || 0;

        // Count unique students
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
        
        // Add animations to stats
        animateStats();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadRecentSubmissions() {
    try {
        const teacherId = window.appState.currentUser.id;

        const { data: submissions, error } = await window.supabase
            .from('submissions')
            .select(`
                *, 
                assignments!inner(title, teacher_id), 
                profiles(full_name), 
                grades(id)
            `)
            .eq('assignments.teacher_id', teacherId)
            .is('grades.id', null)
            .order('submitted_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        const container = document.getElementById('recentSubmissions');
        if (!submissions || submissions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-2">📝</div>
                    <p>No recent submissions</p>
                    <p class="text-sm">Student submissions will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = submissions.map((sub, index) => `
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover-lift animate-fade-in" style="animation-delay: ${index * 0.1}s">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        ${sub.profiles.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 class="font-medium">${sub.profiles.full_name}</h4>
                        <p class="text-sm text-gray-600">${sub.assignments.title}</p>
                        <p class="text-xs text-gray-500">${utils.formatTimeAgo(sub.submitted_at)}</p>
                    </div>
                </div>
                <button onclick="gradeSubmission('${sub.id}')" class="btn btn-primary btn-sm">
                    Grade
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading recent submissions:', error);
    }
}

function animateStats() {
    const statElements = ['classCount', 'studentCount', 'assignmentCount', 'submissionCount'];
    
    statElements.forEach((elementId, index) => {
        const element = document.getElementById(elementId);
        const finalValue = parseInt(element.textContent);
        
        setTimeout(() => {
            animateNumber(element, 0, finalValue, 1000);
        }, index * 200);
    });
}

function animateNumber(element, start, end, duration) {
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (end - start) * easeOutCubic);
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// ========================================
// NAVIGATION
// ========================================

function showSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
        setTimeout(() => targetSection.classList.add('animate-fade-in'), 50);
    }
    
    // Update active nav item
    event.target.classList.add('active');
    currentSection = sectionName;

    // Load section-specific data
    switch(sectionName) {
        case 'classes': 
            loadClasses(); 
            break;
        case 'assignments': 
            loadAssignments(); 
            break;
        case 'submissions': 
            loadSubmissions('pending'); 
            break;
        case 'grades': 
            loadGrades(); 
            break;
    }
}

// ========================================
// CLASSES MANAGEMENT
// ========================================

async function loadClasses() {
    try {
        const teacherId = window.appState.currentUser.id;
        const { data: classes, error } = await window.supabase
            .from('classes')
            .select('*')
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;

        const container = document.getElementById('classesList');
        if (!classes || classes.length === 0) {
            container.innerHTML = `
                <div class="col-span-3 text-center py-12">
                    <div class="text-6xl mb-4">🏛️</div>
                    <h3 class="text-xl font-semibold text-gray-700 mb-2">No classes yet</h3>
                    <p class="text-gray-500 mb-4">Create your first class to get started</p>
                    <button onclick="showCreateClassModal()" class="btn btn-primary">
                        Create Your First Class
                    </button>
                </div>
            `;
            return;
        }

        // Get student counts for each class
        const classesWithCounts = await Promise.all(
            classes.map(async (c, index) => {
                const [enrollments, assignments] = await Promise.all([
                    window.supabase.from('class_enrollments').select('id').eq('class_id', c.id),
                    window.supabase.from('assignments').select('id').eq('class_id', c.id)
                ]);
                
                return {
                    ...c,
                    studentCount: enrollments.data?.length || 0,
                    assignmentCount: assignments.data?.length || 0,
                    animationDelay: index * 0.1
                };
            })
        );

        container.innerHTML = classesWithCounts.map(c => `
            <div class="card hover-lift animate-fade-in" style="animation-delay: ${c.animationDelay}s">
                <div class="card-header">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">${c.name}</h3>
                        <p class="text-sm text-gray-600">${c.subject}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 bg-primary text-white text-xs rounded-full">${c.class_code}</span>
                    </div>
                </div>
                <div class="card-body">
                    <p class="text-gray-600 text-sm mb-4">${c.description || 'No description provided'}</p>
                    <div class="flex justify-between text-sm text-gray-500 mb-4">
                        <span>👥 ${c.studentCount} students</span>
                        <span>📝 ${c.assignmentCount} assignments</span>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="viewClassRoster('${c.id}')" class="btn btn-secondary btn-sm flex-1">
                            View Roster
                        </button>
                        <button onclick="showUploadResourceModal('${c.id}')" class="btn btn-primary btn-sm flex-1">
                            Add Resource
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading classes:', error);
        utils.showNotification('Failed to load classes', 'error');
    }
}

function showCreateClassModal() {
    const modal = document.getElementById('createClassModal');
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeCreateClassModal() {
    const modal = document.getElementById('createClassModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.querySelector('form').reset();
}

async function handleCreateClass(event) {
    event.preventDefault();
    
    try {
        const teacherId = window.appState.currentUser.id;
        const name = document.getElementById('className').value.trim();
        const subject = document.getElementById('classSubject').value.trim();
        const description = document.getElementById('classDescription').value.trim();
        
        // Generate unique class code
        const classCode = generateClassCode();
        
        const { data, error } = await window.supabase
            .from('classes')
            .insert([{
                name,
                subject,
                description,
                class_code: classCode,
                teacher_id: teacherId
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        utils.showNotification(`Class "${name}" created successfully! Class code: ${classCode}`, 'success');
        closeCreateClassModal();
        await loadClasses();
        await loadDashboardData();
    } catch (error) {
        console.error('Error creating class:', error);
        utils.showNotification(`Failed to create class: ${error.message}`, 'error');
    }
}

function generateClassCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function viewClassRoster(classId) {
    try {
        const [classInfo, enrollments] = await Promise.all([
            window.supabase.from('classes').select('*').eq('id', classId).single(),
            window.supabase
                .from('class_enrollments')
                .select('*, profiles(full_name, email)')
                .eq('class_id', classId)
                .order('enrolled_at', { ascending: false })
        ]);

        const modal = document.getElementById('classRosterModal');
        const rosterClassName = document.getElementById('rosterClassName');
        const rosterContent = document.getElementById('classRosterContent');

        rosterClassName.textContent = `${classInfo.data.name} - Roster`;

        if (!enrollments.data || enrollments.data.length === 0) {
            rosterContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-2">👥</div>
                    <p class="text-gray-500">No students enrolled yet</p>
                    <p class="text-sm text-gray-400">Share class code: <strong>${classInfo.data.class_code}</strong></p>
                </div>
            `;
        } else {
            rosterContent.innerHTML = `
                <div class="mb-4 p-4 bg-blue-50 rounded-lg">
                    <p class="text-sm text-blue-800">
                        <strong>Class Code:</strong> ${classInfo.data.class_code} 
                        <button onclick="copyClassCode('${classInfo.data.class_code}')" class="btn btn-sm btn-secondary ml-2">Copy</button>
                    </p>
                </div>
                <div class="space-y-3">
                    ${enrollments.data.map((enrollment, index) => `
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg animate-fade-in" style="animation-delay: ${index * 0.05}s">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                                    ${enrollment.profiles.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h4 class="font-medium">${enrollment.profiles.full_name}</h4>
                                    <p class="text-sm text-gray-600">${enrollment.profiles.email}</p>
                                    <p class="text-xs text-gray-500">Enrolled ${utils.formatDate(enrollment.enrolled_at)}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        modal.classList.add('show');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error loading class roster:', error);
        utils.showNotification('Failed to load class roster', 'error');
    }
}

function closeClassRosterModal() {
    const modal = document.getElementById('classRosterModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
}

function copyClassCode(classCode) {
    navigator.clipboard.writeText(classCode).then(() => {
        utils.showNotification('Class code copied to clipboard!', 'success');
    });
}

// ========================================
// ASSIGNMENTS MANAGEMENT
// ========================================

async function loadAssignments() {
    try {
        const teacherId = window.appState.currentUser.id;
        const { data: assignments, error } = await window.supabase
            .from('assignments')
            .select(`
                *,
                classes(name),
                submissions(id, grades(id))
            `)
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('assignmentsList');
        if (!assignments || assignments.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📝</div>
                    <h3 class="text-xl font-semibold text-gray-700 mb-2">No assignments yet</h3>
                    <p class="text-gray-500 mb-4">Create assignments to engage your students</p>
                    <button onclick="showCreateAssignmentModal()" class="btn btn-primary">
                        Create Your First Assignment
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = assignments.map((assignment, index) => {
            const submissionCount = assignment.submissions.length;
            const gradedCount = assignment.submissions.filter(s => s.grades.length > 0).length;
            const pendingCount = submissionCount - gradedCount;

            return `
                <div class="card hover-lift animate-fade-in" style="animation-delay: ${index * 0.1}s">
                    <div class="card-body">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-800">${assignment.title}</h3>
                                <p class="text-sm text-gray-600">${assignment.classes.name}</p>
                                <p class="text-sm text-gray-500">Due: ${assignment.due_date ? utils.formatDateTime(assignment.due_date) : 'No due date'}</p>
                            </div>
                            <div class="text-right">
                                <div class="text-lg font-bold text-primary">${assignment.max_points} pts</div>
                            </div>
                        </div>
                        
                        <p class="text-gray-600 text-sm mb-4">${assignment.description || 'No description provided'}</p>
                        
                        <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
                            <span>📤 ${submissionCount} submissions</span>
                            <span>✅ ${gradedCount} graded</span>
                            <span>⏳ ${pendingCount} pending</span>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="viewAssignmentSubmissions('${assignment.id}')" class="btn btn-secondary btn-sm flex-1">
                                View Submissions
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading assignments:', error);
        utils.showNotification('Failed to load assignments', 'error');
    }
}

function showCreateAssignmentModal() {
    loadClassesForAssignment();
    const modal = document.getElementById('createAssignmentModal');
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeCreateAssignmentModal() {
    const modal = document.getElementById('createAssignmentModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.querySelector('form').reset();
}

async function loadClassesForAssignment() {
    try {
        const teacherId = window.appState.currentUser.id;
        const { data: classes, error } = await window.supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', teacherId);
        
        if (error) throw error;
        
        const select = document.getElementById('assignmentClass');
        select.innerHTML = '<option value="">Select a class</option>' + 
            (classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading classes for assignment:', error);
    }
}

async function handleCreateAssignment(event) {
    event.preventDefault();
    
    try {
        const teacherId = window.appState.currentUser.id;
        const classId = document.getElementById('assignmentClass').value;
        const title = document.getElementById('assignmentTitle').value.trim();
        const description = document.getElementById('assignmentDescription').value.trim();
        const maxPoints = parseInt(document.getElementById('assignmentMaxPoints').value);
        const dueDate = document.getElementById('assignmentDueDate').value;
        
        if (!classId || !title) {
            utils.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        const { error } = await window.supabase
            .from('assignments')
            .insert([{
                class_id: classId,
                title,
                description,
                max_points: maxPoints,
                due_date: dueDate || null,
                teacher_id: teacherId
            }]);
        
        if (error) throw error;
        
        utils.showNotification('Assignment created successfully!', 'success');
        closeCreateAssignmentModal();
        await loadAssignments();
        await loadDashboardData();
    } catch (error) {
        console.error('Error creating assignment:', error);
        utils.showNotification(`Failed to create assignment: ${error.message}`, 'error');
    }
}

// ========================================
// SUBMISSIONS & GRADING
// ========================================

async function loadSubmissions(status = 'pending') {
    try {
        const teacherId = window.appState.currentUser.id;
        
        let query = window.supabase
            .from('submissions')
            .select(`
                *,
                assignments!inner(title, max_points, teacher_id),
                profiles(full_name),
                grades(points, feedback, graded_at)
            `)
            .eq('assignments.teacher_id', teacherId);

        if (status === 'pending') {
            // Get submissions without grades
            const { data: submissions, error } = await query.is('grades.id', null);
            if (error) throw error;
            displaySubmissions(submissions, status);
        } else if (status === 'graded') {
            // Get submissions with grades
            const { data: submissions, error } = await query.not('grades.id', 'is', null);
            if (error) throw error;
            displaySubmissions(submissions, status);
        }

    } catch (error) {
        console.error('Error loading submissions:', error);
        utils.showNotification('Failed to load submissions', 'error');
    }
}

function displaySubmissions(submissions, status) {
    const container = document.getElementById('submissionsList');
    
    if (!submissions || submissions.length === 0) {
        const emptyMessage = status === 'pending' 
            ? 'No pending submissions' 
            : 'No graded submissions yet';
            
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">📤</div>
                <h3 class="text-xl font-semibold text-gray-700 mb-2">${emptyMessage}</h3>
                <p class="text-gray-500">Student submissions will appear here</p>
            </div>
        `;
        return;
    }

    container.innerHTML = submissions.map((submission, index) => {
        const grade = submission.grades[0];
        
        return `
            <div class="card hover-lift animate-fade-in" style="animation-delay: ${index * 0.05}s">
                <div class="card-body">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                                ${submission.profiles.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 class="font-semibold text-gray-800">${submission.profiles.full_name}</h4>
                                <p class="text-sm text-gray-600">${submission.assignments.title}</p>
                                <p class="text-xs text-gray-500">
                                    Submitted ${utils.formatTimeAgo(submission.submitted_at)}
                                </p>
                                ${submission.file_url ? `
                                    <p class="text-xs text-blue-600">📎 ${submission.file_name}</p>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-3">
                            ${status === 'graded' ? `
                                <div class="text-right">
                                    <div class="text-lg font-bold text-success">
                                        ${grade.points}/${submission.assignments.max_points}
                                    </div>
                                    <div class="text-xs text-gray-500">
                                        ${Math.round((grade.points / submission.assignments.max_points) * 100)}%
                                    </div>
                                </div>
                            ` : ''}
                            
                            <button onclick="gradeSubmission('${submission.id}')" 
                                    class="btn ${status === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-sm">
                                ${status === 'pending' ? 'Grade' : 'Update Grade'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showSubmissions(status) {
    // Update tab buttons
    document.querySelectorAll('#submissions .nav-item').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    loadSubmissions(status);
}

async function gradeSubmission(submissionId) {
    try {
        const { data: submission, error } = await window.supabase
            .from('submissions')
            .select(`
                *,
                assignments(title, max_points),
                profiles(full_name),
                grades(points, feedback)
            `)
            .eq('id', submissionId)
            .single();

        if (error) throw error;

        const modal = document.getElementById('gradeSubmissionModal');
        const detailsDiv = document.getElementById('submissionDetails');
        const submissionIdInput = document.getElementById('gradeSubmissionId');
        const pointsInput = document.getElementById('gradePoints');
        const maxPointsInput = document.getElementById('gradeMaxPoints');
        const feedbackTextarea = document.getElementById('gradeFeedback');

        // Fill in submission details
        detailsDiv.innerHTML = `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="font-semibold">${submission.profiles.full_name}</h4>
                <p class="text-sm text-gray-600">${submission.assignments.title}</p>
                <p class="text-xs text-gray-500">Submitted ${utils.formatDateTime(submission.submitted_at)}</p>
                ${submission.file_url ? `
                    <a href="${submission.file_url}" target="_blank" class="text-blue-600 text-sm hover:underline">
                        📎 ${submission.file_name}
                    </a>
                ` : ''}
                ${submission.content ? `
                    <div class="mt-2 p-2 bg-white rounded border">
                        <p class="text-sm">${submission.content}</p>
                    </div>
                ` : ''}
            </div>
        `;

        // Fill in form
        submissionIdInput.value = submissionId;
        maxPointsInput.value = submission.assignments.max_points;
        
        // If already graded, fill in existing grade
        if (submission.grades && submission.grades.length > 0) {
            pointsInput.value = submission.grades[0].points;
            feedbackTextarea.value = submission.grades[0].feedback || '';
        } else {
            pointsInput.value = '';
            feedbackTextarea.value = '';
        }

        modal.classList.add('show');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error loading submission for grading:', error);
        utils.showNotification('Failed to load submission', 'error');
    }
}

function closeGradeSubmissionModal() {
    const modal = document.getElementById('gradeSubmissionModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.querySelector('form').reset();
}

async function handleGradeSubmission(event) {
    event.preventDefault();
    
    try {
        const submissionId = document.getElementById('gradeSubmissionId').value;
        const points = parseInt(document.getElementById('gradePoints').value);
        const feedback = document.getElementById('gradeFeedback').value.trim();
        const teacherId = window.appState.currentUser.id;

        // Check if grade already exists
        const { data: existingGrade } = await window.supabase
            .from('grades')
            .select('id')
            .eq('submission_id', submissionId)
            .single();

        if (existingGrade) {
            // Update existing grade
            const { error } = await window.supabase
                .from('grades')
                .update({
                    points,
                    feedback,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingGrade.id);

            if (error) throw error;
        } else {
            // Create new grade
            const { error } = await window.supabase
                .from('grades')
                .insert([{
                    submission_id: submissionId,
                    points,
                    feedback,
                    graded_by: teacherId
                }]);

            if (error) throw error;
        }

        utils.showNotification('Grade saved successfully!', 'success');
        closeGradeSubmissionModal();
        await loadSubmissions('pending');
        await loadDashboardData();
    } catch (error) {
        console.error('Error saving grade:', error);
        utils.showNotification(`Failed to save grade: ${error.message}`, 'error');
    }
}

// ========================================
// RESOURCE MANAGEMENT
// ========================================

function showUploadResourceModal(classId = null) {
    loadClassesForResource();
    const modal = document.getElementById('uploadResourceModal');
    
    // Pre-select class if provided
    if (classId) {
        setTimeout(() => {
            document.getElementById('resourceClass').value = classId;
        }, 100);
    }
    
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeUploadResourceModal() {
    const modal = document.getElementById('uploadResourceModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.querySelector('form').reset();
}

async function loadClassesForResource() {
    try {
        const teacherId = window.appState.currentUser.id;
        const { data: classes, error } = await window.supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', teacherId);
        
        if (error) throw error;
        
        const select = document.getElementById('resourceClass');
        select.innerHTML = '<option value="">Select a class</option>' + 
            (classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading classes for resource:', error);
    }
}

async function handleResourceUpload(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.classList.add('btn-loading');
        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        const teacherId = window.appState.currentUser.id;
        const classId = document.getElementById('resourceClass').value;
        const title = document.getElementById('resourceTitle').value.trim();
        const description = document.getElementById('resourceDescription').value.trim();
        const resourceType = document.getElementById('resourceType').value;
        const fileInput = document.getElementById('resourceFile');
        const file = fileInput.files[0];
        
        if (!classId || !title || !file) {
            utils.showNotification('Please fill in all required fields and select a file', 'error');
            return;
        }

        // Upload file to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `class-resources/${classId}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await window.supabase.storage
            .from('study-hub')
            .upload(fileName, file);
            
        if (uploadError) throw uploadError;
        
        const { data: urlData } = window.supabase.storage
            .from('study-hub')
            .getPublicUrl(fileName);

        // Create resource record
        const { error: resourceError } = await window.supabase
            .from('resources')
            .insert([{
                class_id: classId,
                title,
                description,
                file_url: urlData.publicUrl,
                file_name: file.name,
                file_size: file.size,
                resource_type: resourceType,
                uploaded_by: teacherId
            }]);
            
        if (resourceError) throw resourceError;

        utils.showNotification('Resource uploaded successfully!', 'success');
        closeUploadResourceModal();
        await loadDashboardData();
    } catch (error) {
        console.error('Error uploading resource:', error);
        utils.showNotification(`Failed to upload resource: ${error.message}`, 'error');
    } finally {
        submitBtn.classList.remove('btn-loading');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// ========================================
// GRADES MANAGEMENT
// ========================================

async function loadGrades() {
    try {
        // This would load a comprehensive grade management interface
        // For now, we'll show a simple message
        const container = document.getElementById('gradesContent');
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">⭐</div>
                <h3 class="text-xl font-semibold text-gray-700 mb-2">Grade Management</h3>
                <p class="text-gray-500 mb-4">Comprehensive grade management features coming soon</p>
                <p class="text-sm text-gray-400">Use the Submissions section to grade individual assignments</p>
            </div>
        `;
    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

// ========================================
// EVENT LISTENERS & UTILITIES
// ========================================

function initializeEventListeners() {
    // Modal click outside to close
    window.addEventListener('click', (event) => {
        const modals = ['createClassModal', 'createAssignmentModal', 'uploadResourceModal', 
                      'gradeSubmissionModal', 'classRosterModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && event.target === modal) {
                modal.classList.remove('show');
                modal.style.display = 'none';
            }
        });
    });

    // File upload drag and drop
    const fileInputs = document.querySelectorAll('.file-upload-input');
    fileInputs.forEach(input => {
        const label = input.nextElementSibling;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            label.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            label.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            label.addEventListener(eventName, unhighlight, false);
        });

        label.addEventListener('drop', handleDrop, false);

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight(e) {
            label.classList.add('border-primary');
        }

        function unhighlight(e) {
            label.classList.remove('border-primary');
        }

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            input.files = files;
        }
    });
}

// Expose functions globally
window.showSection = showSection;
window.showCreateClassModal = showCreateClassModal;
window.closeCreateClassModal = closeCreateClassModal;
window.handleCreateClass = handleCreateClass;
window.viewClassRoster = viewClassRoster;
window.closeClassRosterModal = closeClassRosterModal;
window.copyClassCode = copyClassCode;
window.showCreateAssignmentModal = showCreateAssignmentModal;
window.closeCreateAssignmentModal = closeCreateAssignmentModal;
window.handleCreateAssignment = handleCreateAssignment;
window.showSubmissions = showSubmissions;
window.gradeSubmission = gradeSubmission;
window.closeGradeSubmissionModal = closeGradeSubmissionModal;
window.handleGradeSubmission = handleGradeSubmission;
window.showUploadResourceModal = showUploadResourceModal;
window.closeUploadResourceModal = closeUploadResourceModal;
window.handleResourceUpload = handleResourceUpload;
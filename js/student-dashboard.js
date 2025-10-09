// Complete Fixed Student Dashboard JavaScript
// All functionality restored and enhanced

// Global state management
let currentSection = 'overview';
let currentFlashcardSet = null;
let currentCardIndex = 0;
let currentResourceType = 'class';
let currentClassId = null;
let currentResourceId = null;

// Flashcard assignment state
let currentFlashcardAssignment = null;
let currentFlashcards = [];
let currentFlashcardIndex = 0;
let flashcardAttemptItems = [];
let flashcardAttemptId = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAuth();
        await loadUserInfo();
        await loadDashboardData();
        initializeEventListeners();
        initializeTimer();
        
        console.log('✅ Student dashboard initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize dashboard:', error);
        window.utils?.showNotification('Failed to initialize dashboard', 'error');
    }
});

// Check authentication
async function checkAuth() {
    if (!window.supabase) {
        throw new Error('Supabase client not initialized');
    }

    const { data: { user }, error } = await window.supabase.auth.getUser();
    
    if (error || !user) {
        window.location.href = 'index.html';
        return;
    }

    window.appState = { currentUser: user };
}

// Load user information
async function loadUserInfo() {
    try {
        const user = window.appState.currentUser;
        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        const userInfoDiv = document.getElementById('userInfo');
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `
                <h4>${profile?.full_name || user.email}</h4>
                <p>Student</p>
            `;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Load dashboard overview data
async function loadDashboardData() {
    try {
        const userId = window.appState.currentUser.id;
        
        // First get enrolled classes
        const { data: enrollments } = await window.supabase
            .from('class_enrollments')
            .select('class_id')
            .eq('student_id', userId)
            .eq('is_active', true);
            
        const classIds = enrollments ? enrollments.map(e => e.class_id) : [];
        
        // Load stats with error handling, only for enrolled classes
        const [classes, assignments, flashcardSets, studySessions, grades] = await Promise.allSettled([
            Promise.resolve({ data: enrollments || [] }),
            classIds.length > 0 ? window.supabase.from('assignments').select(`
                id, class_id,
                submissions!left(id, student_id),
                flashcard_attempts!left(id, student_id, completed_at)
            `).in('class_id', classIds) : Promise.resolve({ data: [] }),
            window.supabase.from('flashcard_sets').select('id').eq('user_id', userId),
            window.supabase.from('study_sessions').select('duration_minutes').eq('user_id', userId).eq('completed', true),
            classIds.length > 0 ? window.supabase.from('grades').select(`
                points,
                submissions!inner(
                    student_id,
                    assignment_id,
                    assignments!inner(max_points, class_id)
                )
            `).eq('submissions.student_id', userId).in('submissions.assignments.class_id', classIds) : Promise.resolve({ data: [] })
        ]);

        // Update stats with safe access
        const classCount = classes.status === 'fulfilled' ? classes.value.data?.length || 0 : 0;
        const pendingAssignments = assignments.status === 'fulfilled' && assignments.value.data ? 
            assignments.value.data.filter(a => {
                const hasSubmission = a.submissions && a.submissions.some(s => s.student_id === userId);
                const hasFlashcardAttempt = a.flashcard_attempts && a.flashcard_attempts.some(fa => fa.student_id === userId && fa.completed_at);
                return !hasSubmission && !hasFlashcardAttempt;
            }).length : 0;
        const flashcardCount = flashcardSets.status === 'fulfilled' ? flashcardSets.value.data?.length || 0 : 0;
        
        // Calculate overall grade percentage
        let overallGrade = '0.0';
        if (grades.status === 'fulfilled' && grades.value.data && grades.value.data.length > 0) {
            const totalPoints = grades.value.data.reduce((sum, grade) => sum + parseFloat(grade.points || 0), 0);
            const totalMaxPoints = grades.value.data.reduce((sum, grade) => sum + parseFloat(grade?.submissions?.assignments?.max_points || 0), 0);
            if (totalMaxPoints > 0) {
                overallGrade = ((totalPoints / totalMaxPoints) * 100).toFixed(1);
            }
        }

        // Update DOM elements safely
        const classCountEl = document.getElementById('classCount');
        const assignmentCountEl = document.getElementById('assignmentCount');
        const flashcardCountEl = document.getElementById('flashcardCount');
        const overallGradeEl = document.getElementById('overallGrade');

        if (classCountEl) classCountEl.textContent = classCount;
        if (assignmentCountEl) assignmentCountEl.textContent = pendingAssignments;
        if (flashcardCountEl) flashcardCountEl.textContent = flashcardCount;
        if (overallGradeEl) overallGradeEl.textContent = overallGrade + '%';

        // Calculate study time
        if (studySessions.status === 'fulfilled' && studySessions.value.data) {
            const totalMinutes = studySessions.value.data.reduce((sum, session) => sum + session.duration_minutes, 0);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const studyHoursEl = document.getElementById('studyHours');
            if (studyHoursEl) studyHoursEl.textContent = `${hours}h ${minutes}m`;
        }

        // Load recent activity
        await loadRecentActivity();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const userId = window.appState.currentUser.id;
        
        const { data: activities, error } = await window.supabase
            .from('submissions')
            .select(`
                id, submitted_at,
                assignments(title, class_id, classes(name))
            `)
            .eq('student_id', userId)
            .order('submitted_at', { ascending: false })
            .limit(5);

        const activityList = document.getElementById('recentActivity');
        if (!activityList) return;

        if (error || !activities || activities.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <p>No recent activity</p>
                    <p>Submit assignments to see your activity here</p>
                </div>
            `;
            return;
        }

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">📝</div>
                <div class="activity-content">
                    <h4>Submitted: ${activity.assignments.title}</h4>
                    <p>Class: ${activity.assignments.classes?.name} • ${formatTimeAgo(activity.submitted_at)}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// Navigation
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const selectedSection = document.getElementById(sectionName);
    if (selectedSection) {
        selectedSection.classList.add('active');
    }
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Find and activate the clicked nav item
    const activeNavItem = Array.from(document.querySelectorAll('.nav-item')).find(item => 
        item.onclick && item.onclick.toString().includes(`'${sectionName}'`)
    );
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    currentSection = sectionName;
    
    // Load section-specific data
    switch(sectionName) {
        case 'classes':
            loadClasses();
            break;
        case 'resources':
            loadResources();
            loadClassesForFilters();
            break;
        case 'assignments':
            loadAssignments();
            break;
        case 'flashcards':
            loadFlashcardSets();
            break;
        case 'ai-assistant':
            loadAIResources();
            break;
        case 'grades':
            loadGrades();
            break;
    }
}

// Classes functions
async function loadClasses() {
    try {
        const userId = window.appState.currentUser.id;
        
        const { data: enrollments, error } = await window.supabase
            .from('class_enrollments')
            .select(`
                *,
                classes(
                    id, name, description, class_code, teacher_id,
                    profiles!classes_teacher_id_fkey(full_name)
                )
            `)
            .eq('student_id', userId)
            .eq('is_active', true);

        if (error) throw error;

        const classesGrid = document.getElementById('classesGrid');
        if (!classesGrid) return;

        if (!enrollments || enrollments.length === 0) {
            classesGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No classes joined yet</h3>
                    <p>Join a class using the class code provided by your teacher</p>
                    <button class="btn-primary" onclick="showJoinClassModal()">Join Your First Class</button>
                </div>
            `;
            return;
        }

        classesGrid.innerHTML = enrollments.map(enrollment => {
            const cls = enrollment.classes;
            return `
                <div class="class-card" onclick="openClassHomepage('${cls.id}')">
                    <div class="class-header">
                        <h3 class="class-name">${cls.name}</h3>
                        <span class="class-code">${cls.class_code}</span>
                    </div>
                    <div class="class-info">
                        <p>${cls.description || 'No description available'}</p>
                        <p><strong>Teacher:</strong> ${cls.profiles?.full_name || 'Unknown'}</p>
                    </div>
                    <div class="class-stats">
                        <div class="stat-item">
                            <div class="stat-value" id="assignments-${cls.id}">-</div>
                            <div class="stat-label">Assignments</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="grade-${cls.id}">-</div>
                            <div class="stat-label">Grade</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Load stats for each class
        for (const enrollment of enrollments) {
            loadClassStats(enrollment.classes.id);
        }

    } catch (error) {
        console.error('Error loading classes:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to load classes', 'error');
        }
    }
}

async function loadClassStats(classId) {
    try {
        const userId = window.appState.currentUser.id;
        
        // Load assignment count
        const { data: assignments } = await window.supabase
            .from('assignments')
            .select('id')
            .eq('class_id', classId);
            
        // Load grade for this class (compute from assignments and grades)
        const { data: classGrades, error: gradeError } = await window.supabase
            .from('grades')
            .select(`
                points,
                submissions!inner(
                    student_id,
                    assignment_id,
                    assignments!inner(max_points, class_id)
                )
            `)
            .eq('submissions.student_id', userId)
            .eq('submissions.assignments.class_id', classId);

        const assignmentCountEl = document.getElementById(`assignments-${classId}`);
        const gradeEl = document.getElementById(`grade-${classId}`);

        if (assignmentCountEl) {
            assignmentCountEl.textContent = assignments?.length || 0;
        }

        if (gradeEl) {
            if (!gradeError && classGrades && classGrades.length > 0) {
                const totalPts = classGrades.reduce((s, g) => s + parseFloat(g.points || 0), 0);
                const totalMax = classGrades.reduce((s, g) => s + parseFloat(g?.submissions?.assignments?.max_points || 0), 0);
                const pct = totalMax > 0 ? ((totalPts / totalMax) * 100).toFixed(1) : '-';
                gradeEl.textContent = totalMax > 0 ? `${pct}%` : '-';
            } else {
                gradeEl.textContent = '-';
            }
        }
    } catch (error) {
        console.error('Error loading class stats:', error);
    }
}

// Join Class Modal Functions
function showJoinClassModal() {
    const modal = document.getElementById('joinClassModal');
    if (modal) {
        modal.style.display = 'block';
        const classCodeInput = document.getElementById('classCode');
        if (classCodeInput) classCodeInput.focus();
    }
}

function closeJoinClassModal() {
    const modal = document.getElementById('joinClassModal');
    if (modal) {
        modal.style.display = 'none';
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

async function handleJoinClass(event) {
    event.preventDefault();
    
    const classCodeInput = document.getElementById('classCode');
    if (!classCodeInput) return;
    
    const classCode = classCodeInput.value.trim().toUpperCase();
    if (!classCode) {
        if (window.utils?.showNotification) {
            window.utils.showNotification('Please enter a class code', 'error');
        }
        return;
    }
    
    try {
        const userId = window.appState.currentUser.id;
        
        // Find the class by class code
        const { data: classData, error: classError } = await window.supabase
            .from('classes')
            .select('*')
            .eq('class_code', classCode)
            .eq('is_active', true)
            .single();
        
        if (classError) {
            if (classError.code === 'PGRST116') {
                if (window.utils?.showNotification) {
                    window.utils.showNotification('Class not found. Please check the class code.', 'error');
                }
            } else {
                throw classError;
            }
            return;
        }
        
        // Check if already enrolled
        const { data: existingEnrollment } = await window.supabase
            .from('class_enrollments')
            .select('id')
            .eq('class_id', classData.id)
            .eq('student_id', userId)
            .single();
        
        if (existingEnrollment) {
            if (window.utils?.showNotification) {
                window.utils.showNotification('You are already enrolled in this class', 'warning');
            }
            closeJoinClassModal();
            return;
        }
        
        // Enroll student in class
        const { error: enrollError } = await window.supabase
            .from('class_enrollments')
            .insert([{
                class_id: classData.id,
                student_id: userId
            }]);
        
        if (enrollError) throw enrollError;
        
        if (window.utils?.showNotification) {
            window.utils.showNotification(`Successfully joined "${classData.name}"!`, 'success');
        }
        closeJoinClassModal();
        
        // Reload data
        await loadClasses();
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error joining class:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification(`Failed to join class: ${error.message}`, 'error');
        }
    }
}

// Resources functions
async function loadResources() {
    try {
        const userId = window.appState.currentUser.id;
        let query;
        let classIds = null;

        if (currentResourceType === 'personal') {
            // Load personal resources
            query = window.supabase
                .from('resources')
                .select(`
                    *,
                    subjects(name),
                    chapters(name),
                    profiles(full_name)
                `)
                .eq('user_id', userId);
        } else {
            // Load class resources
            const { data: enrollments } = await window.supabase
                .from('class_enrollments')
                .select('class_id')
                .eq('student_id', userId)
                .eq('is_active', true);

            if (!enrollments || enrollments.length === 0) {
                const resourcesGrid = document.getElementById('resourcesGrid');
                if (resourcesGrid) {
                    resourcesGrid.innerHTML = `
                        <div class="empty-state">
                            <h3>No classes joined</h3>
                            <p>Join a class to see class resources</p>
                        </div>
                    `;
                }
                return;
            }

            const classIds = enrollments.map(e => e.class_id);
            // Just load all resources since class_id column doesn't exist
            query = window.supabase
                .from('resources')
                .select(`
                    *,
                    subjects(name),
                    chapters(name),
                    profiles(full_name)
                `);
        }

        let resources = [];
        let error = null;
        try {
            const res = await query.order('id', { ascending: false });
            resources = res.data || [];
            error = res.error || null;
        } catch (e) {
            error = e;
        }

        if (error && (error.code === 'PGRST204' || (error.message && error.message.includes('class_id')))) {
            // Fallback when resources.class_id is not available: use class_resources join
            const { data: classRes, error: joinError } = await window.supabase
                .from('class_resources')
                .select('resources!inner(*, subjects(name), chapters(name), profiles(full_name))')
                .in('class_id', classIds)
                .order('id', { ascending: false });
            if (joinError) throw joinError;
            displayResources((classRes || []).map(cr => cr.resources));
            return;
        }

        if (error) throw error;

        displayResources(resources);
    } catch (error) {
        console.error('Error loading resources:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to load resources', 'error');
        }
    }
}

function displayResources(resources) {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;
    
    if (resources.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No resources found</h3>
                <p>${currentResourceType === 'personal' ? 'Upload your first personal resource' : 'No class resources available'}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = resources.map(resource => `
        <div class="resource-card">
            <div class="resource-header">
                <div class="resource-title-row">
                    <h3>${resource.title}</h3>
                    ${resource.is_official ? '<span class="official-badge">Official</span>' : ''}
                </div>
                <div class="resource-meta">
                    <span>${resource.subjects?.name || 'General'}</span>
                    <span class="resource-type">${resource.resource_type}</span>
                </div>
                
                <div class="resource-author">by ${resource.profiles?.full_name}</div>
            </div>
            <div class="resource-body">
                <div class="resource-description">
                    ${resource.description || 'No description available'}
                </div>
                <div class="resource-actions">
                    <button class="btn-primary btn-small" onclick="viewResource('${resource.id}')">View</button>
                    <button class="btn-secondary btn-small" onclick="showResourceComments('${resource.id}')">Comments</button>
                    ${resource.user_id === window.appState.currentUser.id ? 
                        `<button class="btn-secondary btn-small" onclick="deleteResource('${resource.id}')">Delete</button>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function showResourceType(type) {
    currentResourceType = type;
    
    // Update tab buttons
    document.querySelectorAll('.resource-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadResources();
}

async function loadClassesForFilters() {
    try {
        const userId = window.appState.currentUser.id;
        
        const { data: enrollments, error } = await window.supabase
            .from('class_enrollments')
            .select(`
                classes(id, name)
            `)
            .eq('student_id', userId)
            .eq('is_active', true);

        const classFilter = document.getElementById('classFilter');
        if (classFilter && enrollments) {
            const options = enrollments.map(e => 
                `<option value="${e.classes.id}">${e.classes.name}</option>`
            ).join('');
            classFilter.innerHTML = `<option value="">All Classes</option>${options}`;
        }

        // Also populate resource class dropdown
        const resourceClass = document.getElementById('resourceClass');
        if (resourceClass && enrollments) {
            const options = enrollments.map(e => 
                `<option value="${e.classes.id}">${e.classes.name}</option>`
            ).join('');
            resourceClass.innerHTML = `<option value="">Personal Resource</option>${options}`;
        }
    } catch (error) {
        console.error('Error loading classes for filters:', error);
    }
}

function filterResources() {
    // Simple filtering - in a real app, you'd re-query the database
    loadResources();
}

// Resource upload functions
function showUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
        modal.style.display = 'block';
        loadClassesForFilters();
    }
}

function closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
        modal.style.display = 'none';
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

async function handleResourceUpload(event) {
    event.preventDefault();
    
    try {
        const userId = window.appState.currentUser.id;
        const form = event.target;
        const formData = new FormData(form);
        
        const title = document.getElementById('resourceTitle').value.trim();
        const description = document.getElementById('resourceDescription').value.trim();
        const classId = document.getElementById('resourceClass').value || null;
        const subject = document.getElementById('resourceSubject').value.trim();
        const chapter = document.getElementById('resourceChapter').value.trim();
        const type = document.getElementById('resourceType').value;
        const file = document.getElementById('resourceFile').files[0];

        if (!title || !type || !file) {
            if (window.utils?.showNotification) {
                window.utils.showNotification('Please fill in all required fields', 'error');
            }
            return;
        }

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        try {
            // Upload file to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await window.supabase.storage
                .from('study-hub')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // Get or create subject
            let subjectId = null;
            if (subject) {
                const { data: existingSubject } = await window.supabase
                    .from('subjects')
                    .select('id')
                    .eq('name', subject)
                    .single();

                if (existingSubject) {
                    subjectId = existingSubject.id;
                } else {
                    const { data: newSubject, error: subjectError } = await window.supabase
                        .from('subjects')
                        .insert([{ name: subject }])
                        .select('id')
                        .single();
                    
                    if (subjectError) throw subjectError;
                    subjectId = newSubject.id;
                }
            }

            // Get or create chapter
            let chapterId = null;
            if (chapter && subjectId) {
                const { data: existingChapter } = await window.supabase
                    .from('chapters')
                    .select('id')
                    .eq('name', chapter)
                    .eq('subject_id', subjectId)
                    .single();

                if (existingChapter) {
                    chapterId = existingChapter.id;
                } else {
                    const { data: newChapter, error: chapterError } = await window.supabase
                        .from('chapters')
                        .insert([{ 
                            name: chapter, 
                            subject_id: subjectId,
                            order_index: 0
                        }])
                        .select('id')
                        .single();
                    
                    if (chapterError) throw chapterError;
                    chapterId = newChapter.id;
                }
            }

            // Get file URL
            const { data: urlData } = window.supabase.storage
                .from('study-hub')
                .getPublicUrl(fileName);

            // Create resource record
            const { data: resourceData, error: resourceError } = await window.supabase
                .from('resources')
                .insert([{
                    user_id: userId,
                    title,
                    description,
                    subject_id: subjectId,
                    chapter_id: chapterId,
                    resource_type: type,
                    file_url: urlData.publicUrl,
                    file_name: file.name,
                    file_size: file.size,
                    is_official: false // Students can't upload official resources
                }])
                .select('id')
                .single();

            if (resourceError) throw resourceError;

            // If a class is selected, link the resource to the class via class_resources
            if (classId) {
                const { error: linkError } = await window.supabase
                    .from('class_resources')
                    .insert([{ class_id: classId, resource_id: resourceData.id }]);
                if (linkError) throw linkError;
            }

            if (window.utils?.showNotification) {
                window.utils.showNotification('Resource uploaded successfully!', 'success');
            }
            closeUploadModal();
            await loadResources();
            await loadDashboardData();
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error uploading resource:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification(`Failed to upload resource: ${error.message}`, 'error');
        }
    }
}

async function viewResource(resourceId) {
    try {
        const { data: resource, error } = await window.supabase
            .from('resources')
            .select('file_url, file_name')
            .eq('id', resourceId)
            .single();

        if (error) throw error;

        if (resource.file_url) {
            // Open directly in new tab - browser will display if possible
            const viewerWindow = window.open(resource.file_url, '_blank');
            
            // If popup was blocked, notify user
            if (!viewerWindow) {
                if (window.utils?.showNotification) {
                    window.utils.showNotification('Please allow popups to view resources', 'warning');
                }
            }
        } else {
            if (window.utils?.showNotification) {
                window.utils.showNotification('File not available', 'error');
            }
        }
    } catch (error) {
        console.error('Error viewing resource:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to view resource', 'error');
        }
    }
}

// Assignment functions
async function loadAssignments(status = 'pending') {
    try {
        const userId = window.appState.currentUser.id;
        
        // Get enrolled classes
        const { data: enrollments } = await window.supabase
            .from('class_enrollments')
            .select('class_id')
            .eq('student_id', userId)
            .eq('is_active', true);

        if (!enrollments || enrollments.length === 0) {
            const assignmentsList = document.getElementById('assignmentsList');
            if (assignmentsList) {
                assignmentsList.innerHTML = `
                    <div class="empty-state">
                        <h3>No classes enrolled</h3>
                        <p>Join a class to see assignments</p>
                    </div>
                `;
            }
            return;
        }

        const classIds = enrollments.map(e => e.class_id);

        const { data: assignments, error } = await window.supabase
            .from('assignments')
            .select(`
                *,
                classes(name),
                submissions!left(id, submitted_at, grades(points, feedback, graded_at)),
                flashcard_assignment_links!left(flashcard_set_id),
                flashcard_attempts!left(id, score, completed_at)
            `)
            .in('class_id', classIds)
            .order('due_date', { ascending: true });

        if (error) throw error;

        const now = new Date();
        let filteredAssignments = [];

        (assignments || []).forEach(assignment => {
            const dueDate = new Date(assignment.due_date);
            const isFlashcard = assignment.flashcard_assignment_links && assignment.flashcard_assignment_links.length > 0;
            const hasSubmission = assignment.submissions.length > 0;
            const hasAttempt = assignment.flashcard_attempts && assignment.flashcard_attempts.length > 0;
            const hasGrade = hasSubmission && assignment.submissions[0].grades && assignment.submissions[0].grades.length > 0;
            const hasFlashcardGrade = hasAttempt && assignment.flashcard_attempts[0].completed_at;
            
            // Set additional properties for UI
            assignment.isFlashcard = isFlashcard;
            if (isFlashcard && hasAttempt) {
                assignment.flashcardScore = assignment.flashcard_attempts[0].score;
                assignment.flashcardCompleted = assignment.flashcard_attempts[0].completed_at;
            }

            if (status === 'pending' && ((isFlashcard && !hasAttempt) || (!isFlashcard && !hasSubmission)) && dueDate > now) {
                filteredAssignments.push({ ...assignment, status: 'pending' });
            } else if (status === 'submitted' && ((isFlashcard && hasAttempt && !hasFlashcardGrade) || (!isFlashcard && hasSubmission && !hasGrade))) {
                filteredAssignments.push({ ...assignment, status: 'submitted' });
            } else if (status === 'graded' && ((isFlashcard && hasFlashcardGrade) || (!isFlashcard && hasGrade))) {
                filteredAssignments.push({ ...assignment, status: 'graded' });
            }
        });

        displayAssignments(filteredAssignments);
    } catch (error) {
        console.error('Error loading assignments:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to load assignments', 'error');
        }
    }
}

function displayAssignments(assignments) {
    const container = document.getElementById('assignmentsList');
    if (!container) return;
    
    if (assignments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No assignments</h3>
                <p>No assignments found for this category</p>
            </div>
        `;
        return;
    }

    container.innerHTML = assignments.map(assignment => `
        <div class="assignment-card">
            <div class="assignment-header">
                <div>
                    <h3 class="assignment-title">${assignment.title}</h3>
                    <div class="assignment-meta">
                        Class: ${assignment.classes.name} | Due: ${formatDateTime(assignment.due_date)} | Points: ${assignment.max_points}
                    </div>
                </div>
                <div class="assignment-status status-${assignment.status}">${assignment.status}</div>
            </div>
            <div class="assignment-description">${assignment.description}</div>
            <div class="assignment-actions">
                ${assignment.status === 'pending' ? `
                    ${assignment.isFlashcard ? 
                        `<button class="btn-primary btn-small" onclick="startFlashcardAssignment('${assignment.id}')">Start Flashcards</button>` : 
                        `<button class="btn-primary btn-small" onclick="submitAssignment('${assignment.id}')">Submit</button>`
                    }
                ` : assignment.status === 'graded' ? `
                    <span class="grade-display">Grade: ${assignment.submissions[0] ? assignment.submissions[0].grades[0].points : assignment.flashcardScore}/${assignment.max_points}</span>
                    <button class="btn-secondary btn-small" onclick="viewFeedback('${assignment.id}')">View Feedback</button>
                ` : `
                    <span class="submitted-info">${assignment.isFlashcard ? 'Completed flashcards' : 'Submitted'} on ${assignment.submissions[0] ? formatDate(assignment.submissions[0].submitted_at) : formatDate(assignment.flashcardCompleted)}</span>
                `}
            </div>
        </div>
    `).join('');
}

function showAssignments(status) {
    // Update tab buttons
    document.querySelectorAll('.assignment-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    loadAssignments(status);
}

// Assignment submission functions
async function submitAssignment(assignmentId) {
    const modal = document.getElementById('assignmentSubmissionModal');
    if (!modal) return;
    
    // Set assignment ID
    const assignmentInput = document.getElementById('submissionAssignmentId');
    if (assignmentInput) {
        assignmentInput.value = assignmentId;
    }
    
    // Clear previous content
    const textInput = document.getElementById('submissionText');
    if (textInput) textInput.value = '';
    
    const fileInput = document.getElementById('submissionFile');
    if (fileInput) fileInput.value = '';
    
    // Load assignment details
    try {
        const { data: assignment, error } = await window.supabase
            .from('assignments')
            .select('title, description, due_date, max_points')
            .eq('id', assignmentId)
            .single();
        
        if (!error && assignment) {
            const detailsDiv = document.getElementById('assignmentSubmissionDetails');
            if (detailsDiv) {
                detailsDiv.innerHTML = `
                    <h4>${assignment.title}</h4>
                    <p>${assignment.description}</p>
                    <p><strong>Due:</strong> ${formatDateTime(assignment.due_date)} | <strong>Points:</strong> ${assignment.max_points}</p>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading assignment details:', error);
    }
    
    modal.style.display = 'block';
}

function closeAssignmentSubmissionModal() {
    const modal = document.getElementById('assignmentSubmissionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleAssignmentSubmission(event) {
    event.preventDefault();
    
    try {
        const userId = window.appState.currentUser.id;
        const assignmentId = document.getElementById('submissionAssignmentId').value;
        const text = document.getElementById('submissionText').value.trim();
        const fileInput = document.getElementById('submissionFile');
        const file = fileInput.files[0];
        
        if (!text && !file) {
            if (window.utils?.showNotification) {
                window.utils.showNotification('Please provide either text or file submission', 'error');
            }
            return;
        }
        
        let fileUrl = null;
        let fileName = null;
        
        if (file) {
            // Upload file
            const fileExt = file.name.split('.').pop();
            const uploadFileName = `${userId}/${Date.now()}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await window.supabase.storage
                .from('study-hub')
                .upload(uploadFileName, file);
                
            if (uploadError) throw uploadError;
            
            const { data: urlData } = window.supabase.storage
                .from('study-hub')
                .getPublicUrl(uploadFileName);
                
            fileUrl = urlData.publicUrl;
            fileName = file.name;
        }
        
        // Check if submission already exists
        const { data: existing } = await window.supabase
            .from('submissions')
            .select('id')
            .eq('assignment_id', assignmentId)
            .eq('student_id', userId)
            .single();
            
        if (existing) {
            // Update existing submission
            const { error: updateError } = await window.supabase
                .from('submissions')
                .update({
                    content: text || null,
                    file_url: fileUrl || null,
                    file_name: fileName || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);
                
            if (updateError) throw updateError;
        } else {
            // Create new submission
            const { error: insertError } = await window.supabase
                .from('submissions')
                .insert([{
                    assignment_id: assignmentId,
                    student_id: userId,
                    content: text || null,
                    file_url: fileUrl || null,
                    file_name: fileName || null
                }]);
                
            if (insertError) throw insertError;
        }
        
        if (window.utils?.showNotification) {
            window.utils.showNotification('Assignment submitted successfully!', 'success');
        }
        closeAssignmentSubmissionModal();
        await loadAssignments();
        await loadDashboardData();
    } catch (error) {
        console.error('Error submitting assignment:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification(`Failed to submit assignment: ${error.message}`, 'error');
        }
    }
}

async function viewFeedback(assignmentId) {
    try {
        const userId = window.appState.currentUser.id;
        const { data: submission, error } = await window.supabase
            .from('submissions')
            .select('id, submitted_at, updated_at, grades(points, feedback, graded_at)')
            .eq('assignment_id', assignmentId)
            .eq('student_id', userId)
            .single();
            
        if (error) throw error;
        
        const modal = document.getElementById('feedbackModal');
        const content = document.getElementById('feedbackContent');
        
        if (!submission || !submission.grades || submission.grades.length === 0) {
            content.innerHTML = '<p>No feedback available yet.</p>';
        } else {
            const grade = submission.grades[0];
            content.innerHTML = `
                <div>
                    <p><strong>Points:</strong> ${grade.points}</p>
                    <p><strong>Feedback:</strong></p>
                    <div class="feedback-text">${(grade.feedback || '').replace(/\n/g, '<br>')}</div>
                    <p class="muted">Graded on ${formatDateTime(grade.graded_at)}</p>
                </div>
            `;
        }
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading feedback:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to load feedback', 'error');
        }
    }
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.style.display = 'none';
}

// Flashcard assignment functions
async function startFlashcardAssignment(assignmentId) {
    try {
        // Get assignment and linked flashcard set
        const { data: assignment, error: assignmentError } = await window.supabase
            .from('assignments')
            .select(`
                *,
                flashcard_assignment_links!inner(flashcard_set_id),
                classes(name)
            `)
            .eq('id', assignmentId)
            .single();
        
        if (assignmentError) throw assignmentError;
        
        const flashcardSetId = assignment.flashcard_assignment_links[0].flashcard_set_id;
        
        // Get flashcards
        const { data: flashcards, error: flashcardsError } = await window.supabase
            .from('flashcards')
            .select('*')
            .eq('set_id', flashcardSetId)
            .order('order_index');
        
        if (flashcardsError) throw flashcardsError;
        
        if (!flashcards || flashcards.length === 0) {
            if (window.utils?.showNotification) {
                window.utils.showNotification('No flashcards found in this assignment', 'error');
            }
            return;
        }
        
        // Create attempt record
        const userId = window.appState.currentUser.id;
        const { data: attempt, error: attemptError } = await window.supabase
            .from('flashcard_attempts')
            .insert([{
                assignment_id: assignmentId,
                student_id: userId,
                total_count: flashcards.length
            }])
            .select()
            .single();
        
        if (attemptError) throw attemptError;
        
        // Setup state
        currentFlashcardAssignment = assignment;
        currentFlashcards = flashcards;
        currentFlashcardIndex = 0;
        flashcardAttemptItems = [];
        flashcardAttemptId = attempt.id;
        
        // Show modal and start
        document.getElementById('flashcardAssignmentTitle').textContent = `${assignment.title} - ${assignment.classes.name}`;
        document.getElementById('totalCardsCount').textContent = flashcards.length;
        document.getElementById('flashcardAssignmentModal').style.display = 'block';
        document.getElementById('flashcardAssignmentCard').style.display = 'block';
        document.getElementById('flashcardAssignmentComplete').style.display = 'none';
        
        showCurrentFlashcard();
    } catch (error) {
        console.error('Error starting flashcard assignment:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification(`Failed to start assignment: ${error.message}`, 'error');
        }
    }
}

function showCurrentFlashcard() {
    if (currentFlashcardIndex >= currentFlashcards.length) {
        completeFlashcardAssignment();
        return;
    }
    
    const card = currentFlashcards[currentFlashcardIndex];
    document.getElementById('currentCardIndex').textContent = currentFlashcardIndex + 1;
    document.getElementById('flashcardQuestion').textContent = card.question;
    document.getElementById('flashcardStudentAnswer').value = '';
    
    // Show answer section, hide result
    document.getElementById('flashcardAnswerSection').style.display = 'block';
    document.getElementById('flashcardResult').style.display = 'none';
}

async function submitFlashcardAnswer() {
    try {
        const card = currentFlashcards[currentFlashcardIndex];
        const studentAnswer = document.getElementById('flashcardStudentAnswer').value.trim();
        
        if (!studentAnswer) {
            if (window.utils?.showNotification) {
                window.utils.showNotification('Please enter an answer', 'warning');
            }
            return;
        }
        
        // Simple correctness check
        const correct = checkAnswerCorrectness(studentAnswer, card.answer);
        
        // Save attempt item
        const { error: itemError } = await window.supabase
            .from('flashcard_attempt_items')
            .insert([{
                attempt_id: flashcardAttemptId,
                card_id: card.id,
                student_answer: studentAnswer,
                correct: correct
            }]);
        
        if (itemError) throw itemError;
        
        flashcardAttemptItems.push({ card_id: card.id, correct });
        
        // Show result
        document.getElementById('flashcardAnswerSection').style.display = 'none';
        document.getElementById('flashcardResult').style.display = 'block';
        document.getElementById('flashcardCorrectAnswer').innerHTML = `<strong>Correct Answer:</strong><br>${card.answer}`;
        document.getElementById('flashcardFeedback').innerHTML = correct ? 
            '<span style="color: green;">✓ Correct!</span>' : 
            '<span style="color: red;">✗ Incorrect</span>';
        
        if (currentFlashcardIndex >= currentFlashcards.length - 1) {
            document.querySelector('#flashcardResult .btn-primary').textContent = 'Finish Assignment';
        }
    } catch (error) {
        console.error('Error submitting flashcard answer:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to submit answer', 'error');
        }
    }
}

function checkAnswerCorrectness(studentAnswer, correctAnswer) {
    // More strict checking - must be exact match or very close
    const studentText = studentAnswer.toLowerCase().trim();
    const correctText = correctAnswer.toLowerCase().trim();
    
    // Exact match
    if (studentText === correctText) {
        return true;
    }
    
    // Remove common punctuation and extra spaces for comparison
    const normalize = (text) => text.replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
    const normalizedStudent = normalize(studentText);
    const normalizedCorrect = normalize(correctText);
    
    if (normalizedStudent === normalizedCorrect) {
        return true;
    }
    
    // For very short answers, require exact match
    if (correctText.length <= 10) {
        return false;
    }
    
    // For longer answers, check if student answer contains the key concepts
    const studentWords = normalizedStudent.split(/\s+/);
    const correctWords = normalizedCorrect.split(/\s+/);
    
    // Must contain at least 70% of the words from correct answer
    const matchingWords = correctWords.filter(word => 
        word.length > 2 && studentWords.some(sw => sw.includes(word) || word.includes(sw))
    );
    
    return matchingWords.length >= Math.max(1, correctWords.length * 0.7);
}

function nextFlashcardQuestion() {
    currentFlashcardIndex++;
    if (currentFlashcardIndex >= currentFlashcards.length) {
        completeFlashcardAssignment();
    } else {
        showCurrentFlashcard();
    }
}

async function completeFlashcardAssignment() {
    try {
        const correctCount = flashcardAttemptItems.filter(item => item.correct).length;
        const totalCount = flashcardAttemptItems.length;
        const score = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
        
        // Update attempt with final results
        const { error: updateError } = await window.supabase
            .from('flashcard_attempts')
            .update({
                correct_count: correctCount,
                score: score,
                completed_at: new Date().toISOString()
            })
            .eq('id', flashcardAttemptId);
        
        if (updateError) throw updateError;
        
        // Show completion screen
        document.getElementById('flashcardAssignmentCard').style.display = 'none';
        document.getElementById('flashcardAssignmentComplete').style.display = 'block';
        document.getElementById('flashcardFinalScore').innerHTML = `
            <p><strong>Score: ${score.toFixed(1)}%</strong></p>
            <p>Correct: ${correctCount} out of ${totalCount}</p>
        `;
        
        if (window.utils?.showNotification) {
            window.utils.showNotification('Flashcard assignment completed!', 'success');
        }
    } catch (error) {
        console.error('Error completing flashcard assignment:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to complete assignment', 'error');
        }
    }
}

function closeFlashcardAssignmentModal() {
    document.getElementById('flashcardAssignmentModal').style.display = 'none';
    // Reset state
    currentFlashcardAssignment = null;
    currentFlashcards = [];
    currentFlashcardIndex = 0;
    flashcardAttemptItems = [];
    flashcardAttemptId = null;
    // Reload assignments to show updated status
    loadAssignments();
}

// Flashcard functions for personal sets
async function loadFlashcardSets() {
    try {
        const userId = window.appState.currentUser.id;
        
        const { data: sets, error } = await window.supabase
            .from('flashcard_sets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('flashcardSets');
        if (!container) return;
        
        if (!sets || sets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No flashcard sets</h3>
                    <p>Create your first flashcard set to start studying</p>
                </div>
            `;
            return;
        }

        container.innerHTML = sets.map(set => `
            <div class="flashcard-set-card" onclick="openFlashcardSet('${set.id}')">
                <h3>${set.name}</h3>
                <p>${set.subject || 'General'}</p>
                <div class="flashcard-count">${set.card_count || 0} cards</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading flashcard sets:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to load flashcard sets', 'error');
        }
    }
}

function showCreateFlashcardModal() {
    const modal = document.getElementById('createFlashcardModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeCreateFlashcardModal() {
    const modal = document.getElementById('createFlashcardModal');
    if (!modal) return;
    
    modal.style.display = 'none';
    const form = modal.querySelector('form');
    if (form) form.reset();
    
    // Reset to one card pair
    const container = document.getElementById('flashcardInputs');
    if (container) {
        container.innerHTML = `
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
    if (!container) return;
    
    const currentCount = container.children.length;
    
    const newPair = document.createElement('div');
    newPair.className = 'flashcard-input-pair';
    newPair.innerHTML = `
        <div class="form-group">
            <label>Question ${currentCount + 1}</label>
            <textarea class="flashcard-question" required></textarea>
        </div>
        <div class="form-group">
            <label>Answer ${currentCount + 1}</label>
            <textarea class="flashcard-answer" required></textarea>
        </div>
        <button type="button" class="btn-danger btn-small remove-card-btn" onclick="removeFlashcardInput(this)">Remove</button>
    `;
    
    container.appendChild(newPair);
}

function removeFlashcardInput(button) {
    const container = document.getElementById('flashcardInputs');
    if (!container) return;
    
    // Don't allow removing the last card pair
    if (container.children.length > 1) {
        button.parentElement.remove();
        
        // Update numbering
        Array.from(container.children).forEach((pair, index) => {
            const labels = pair.querySelectorAll('label');
            if (labels.length >= 2) {
                labels[0].textContent = `Question ${index + 1}`;
                labels[1].textContent = `Answer ${index + 1}`;
            }
        });
    }
}

async function handleCreateFlashcardSet(event) {
    event.preventDefault();
    
    try {
        const userId = window.appState.currentUser.id;
        const setName = document.getElementById('flashcardSetName').value.trim();
        const subject = document.getElementById('flashcardSubject').value.trim();
        
        if (!setName) {
            if (window.utils?.showNotification) {
                window.utils.showNotification('Please enter a flashcard set name', 'error');
            }
            return;
        }

        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;

        try {
            // Create flashcard set
            const { data: set, error: setError } = await window.supabase
                .from('flashcard_sets')
                .insert([{
                    user_id: userId,
                    name: setName,
                    subject: subject || 'General'
                }])
                .select()
                .single();

            if (setError) throw setError;

            // Create flashcards
            const questions = document.querySelectorAll('.flashcard-question');
            const answers = document.querySelectorAll('.flashcard-answer');
            
            const flashcards = [];
            for (let i = 0; i < questions.length; i++) {
                const questionText = questions[i].value.trim();
                const answerText = answers[i].value.trim();
                
                if (questionText && answerText) {
                    flashcards.push({
                        set_id: set.id,
                        question: questionText,
                        answer: answerText,
                        order_index: i
                    });
                }
            }

            if (flashcards.length === 0) {
                if (window.utils?.showNotification) {
                    window.utils.showNotification('Please add at least one complete flashcard (question and answer)', 'error');
                }
                return;
            }

            const { error: cardsError } = await window.supabase
                .from('flashcards')
                .insert(flashcards);

            if (cardsError) throw cardsError;

            if (window.utils?.showNotification) {
                window.utils.showNotification(`Flashcard set created with ${flashcards.length} cards!`, 'success');
            }
            closeCreateFlashcardModal();
            await loadFlashcardSets();
            await loadDashboardData();
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error creating flashcard set:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification(`Failed to create flashcard set: ${error.message}`, 'error');
        }
    }
}

async function openFlashcardSet(setId) {
    try {
        const { data: cards, error } = await window.supabase
            .from('flashcards')
            .select('*')
            .eq('set_id', setId)
            .order('order_index');

        if (error) throw error;

        if (!cards || cards.length === 0) {
            if (window.utils?.showNotification) {
                window.utils.showNotification('This flashcard set is empty', 'warning');
            }
            return;
        }

        currentFlashcardSet = cards;
        currentCardIndex = 0;
        
        const setsContainer = document.getElementById('flashcardSets');
        const viewerContainer = document.getElementById('flashcardViewer');
        
        if (setsContainer) setsContainer.style.display = 'none';
        if (viewerContainer) viewerContainer.style.display = 'block';
        
        showCurrentCard();
    } catch (error) {
        console.error('Error opening flashcard set:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to open flashcard set', 'error');
        }
    }
}

function showCurrentCard() {
    if (!currentFlashcardSet || currentFlashcardSet.length === 0) return;
    
    const card = currentFlashcardSet[currentCardIndex];
    const questionElement = document.getElementById('cardQuestion');
    const answerElement = document.getElementById('cardAnswer');
    const counterElement = document.getElementById('cardCounter');
    
    if (questionElement) questionElement.textContent = card.question;
    if (answerElement) answerElement.textContent = card.answer;
    if (counterElement) counterElement.textContent = `${currentCardIndex + 1} / ${currentFlashcardSet.length}`;
    
    // Reset card to front side
    const flashcard = document.querySelector('.flashcard');
    if (flashcard) flashcard.classList.remove('flipped');
}

function flipCard() {
    const flashcard = document.querySelector('.flashcard');
    if (flashcard) flashcard.classList.toggle('flipped');
}

function nextCard() {
    if (currentFlashcardSet && currentCardIndex < currentFlashcardSet.length - 1) {
        currentCardIndex++;
        showCurrentCard();
    }
}

function previousCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        showCurrentCard();
    }
}

function shuffleCards() {
    if (!currentFlashcardSet) return;
    
    for (let i = currentFlashcardSet.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentFlashcardSet[i], currentFlashcardSet[j]] = [currentFlashcardSet[j], currentFlashcardSet[i]];
    }
    
    currentCardIndex = 0;
    showCurrentCard();
    if (window.utils?.showNotification) {
        window.utils.showNotification('Cards shuffled!', 'success');
    }
}

function closeFlashcardViewer() {
    const setsContainer = document.getElementById('flashcardSets');
    const viewerContainer = document.getElementById('flashcardViewer');
    
    if (setsContainer) setsContainer.style.display = 'grid';
    if (viewerContainer) viewerContainer.style.display = 'none';
    
    currentFlashcardSet = null;
    currentCardIndex = 0;
}

// Study Timer functions
function initializeTimer() {
    updateTimerDisplay();
    loadTimerStats();
    
    // Setup timer input handlers
    const workDurationInput = document.getElementById('workDuration');
    const breakDurationInput = document.getElementById('breakDuration');
    
    if (workDurationInput) {
        workDurationInput.addEventListener('change', (e) => {
            timerState.workDuration = parseInt(e.target.value);
            if (!timerState.isBreak && !timerState.isRunning) {
                timerState.timeLeft = timerState.workDuration * 60;
                updateTimerDisplay();
            }
        });
    }
    
    if (breakDurationInput) {
        breakDurationInput.addEventListener('change', (e) => {
            timerState.breakDuration = parseInt(e.target.value);
            if (timerState.isBreak && !timerState.isRunning) {
                timerState.timeLeft = timerState.breakDuration * 60;
                updateTimerDisplay();
            }
        });
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerState.timeLeft / 60);
    const seconds = timerState.timeLeft % 60;
    
    const timerTimeElement = document.getElementById('timerTime');
    const timerLabelElement = document.getElementById('timerLabel');
    const timerProgressElement = document.getElementById('timerProgress');
    
    if (timerTimeElement) {
        timerTimeElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (timerLabelElement) {
        timerLabelElement.textContent = 
            timerState.isBreak ? 'Break Time' : 'Work Session';
    }
    
    // Update progress circle
    if (timerProgressElement) {
        const totalTime = timerState.isBreak ? 
            timerState.breakDuration * 60 : timerState.workDuration * 60;
        const progress = ((totalTime - timerState.timeLeft) / totalTime) * 283;
        timerProgressElement.style.strokeDashoffset = 283 - progress;
    }
}

function toggleTimer() {
    if (timerState.isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    timerState.isRunning = true;
    const timerBtn = document.getElementById('timerBtn');
    if (timerBtn) timerBtn.textContent = 'Pause';
    
    timerInterval = setInterval(() => {
        timerState.timeLeft--;
        updateTimerDisplay();
        
        if (timerState.timeLeft <= 0) {
            completeSession();
        }
    }, 1000);
}

function pauseTimer() {
    timerState.isRunning = false;
    const timerBtn = document.getElementById('timerBtn');
    if (timerBtn) timerBtn.textContent = 'Start';
    clearInterval(timerInterval);
}

async function completeSession() {
    clearInterval(timerInterval);
    timerState.isRunning = false;
    
    try {
        // Save session to database
        const userId = window.appState.currentUser.id;
        const duration = timerState.isBreak ? timerState.breakDuration : timerState.workDuration;
        
        await window.supabase
            .from('study_sessions')
            .insert([{
                user_id: userId,
                session_type: timerState.isBreak ? 'break' : 'work',
                duration_minutes: duration,
                completed: true,
                completed_at: new Date().toISOString()
            }]);

        if (window.utils?.showNotification) {
            window.utils.showNotification(
                timerState.isBreak ? 'Break complete!' : 'Work session complete!', 
                'success'
            );
        }
    } catch (error) {
        console.error('Error saving study session:', error);
    }
    
    // Switch between work and break
    timerState.isBreak = !timerState.isBreak;
    timerState.timeLeft = timerState.isBreak ? 
        timerState.breakDuration * 60 : timerState.workDuration * 60;
    
    const timerBtn = document.getElementById('timerBtn');
    if (timerBtn) timerBtn.textContent = 'Start';
    
    updateTimerDisplay();
    loadTimerStats();
}

function resetTimer() {
    clearInterval(timerInterval);
    timerState.isRunning = false;
    timerState.timeLeft = timerState.isBreak ? 
        timerState.breakDuration * 60 : timerState.workDuration * 60;
    
    const timerBtn = document.getElementById('timerBtn');
    if (timerBtn) timerBtn.textContent = 'Start';
    
    updateTimerDisplay();
}

async function loadTimerStats() {
    try {
        const userId = window.appState.currentUser.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: sessions, error } = await window.supabase
            .from('study_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('completed', true)
            .gte('completed_at', today.toISOString());

        if (error) throw error;

        const workSessions = (sessions || []).filter(s => s.session_type === 'work');
        const totalMinutes = workSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        const completedElement = document.getElementById('sessionsCompleted');
        const totalTimeElement = document.getElementById('totalStudyTime');
        
        if (completedElement) completedElement.textContent = workSessions.length;
        if (totalTimeElement) totalTimeElement.textContent = `${hours}h ${minutes}m`;
    } catch (error) {
        console.error('Error loading timer stats:', error);
    }
}

// AI Assistant functions
async function generateAIContent(type) {
    const fileInput = document.getElementById('aiResourceFile');
    const titleInput = document.getElementById('aiResourceTitle');
    
    if (!fileInput.files[0]) {
        if (window.utils?.showNotification) {
            window.utils.showNotification('Please select a file first', 'error');
        }
        return;
    }
    
    const file = fileInput.files[0];
    const title = titleInput.value.trim() || file.name;
    
    try {
        // Show loading
        const resultsDiv = document.getElementById('aiResults');
        resultsDiv.innerHTML = `
            <div class="ai-loading">
                <h3>Processing ${file.name}...</h3>
                <p>Generating ${type}. This may take a moment.</p>
            </div>
        `;
        
        // Process with AI service
        const result = await window.aiService.processResource(file, type, title);
        
        // Display results
        displayAIResults(result);
        
    } catch (error) {
        console.error('AI generation error:', error);
        const resultsDiv = document.getElementById('aiResults');
        resultsDiv.innerHTML = `
            <div class="ai-error">
                <h3>Error</h3>
                <p>${error.message}</p>
                <p class="hint">Make sure you have configured your Gemini API key in js/ai-service.js</p>
            </div>
        `;
    }
}

function displayAIResults(result) {
    const resultsDiv = document.getElementById('aiResults');
    
    if (result.type === 'flashcards') {
        resultsDiv.innerHTML = `
            <div class="ai-result">
                <h3>Generated Flashcards</h3>
                <p>Generated ${result.content.total_count} flashcards from "${result.title}"</p>
                <div class="flashcards-preview">
                    ${result.content.flashcards.slice(0, 3).map((card, i) => `
                        <div class="flashcard-preview">
                            <strong>Q${i + 1}:</strong> ${card.question}<br>
                            <strong>A:</strong> ${card.answer}
                        </div>
                    `).join('')}
                    ${result.content.flashcards.length > 3 ? 
                        `<p>... and ${result.content.flashcards.length - 3} more cards</p>` : ''}
                </div>
                <button class="btn-primary" onclick="createFlashcardSetFromAI(${JSON.stringify(result).replace(/"/g, '&quot;')})">
                    Create Flashcard Set
                </button>
            </div>
        `;
    } else {
        resultsDiv.innerHTML = `
            <div class="ai-result">
                <h3>${result.type === 'summary' ? 'Summary' : 'Study Plan'} for "${result.title}"</h3>
                <div class="ai-content">
                    ${result.content.replace(/\n/g, '<br>')}
                </div>
                <div class="ai-actions">
                    <button class="btn-secondary" onclick="copyToClipboard(this)">Copy to Clipboard</button>
                </div>
            </div>
        `;
    }
}

async function createFlashcardSetFromAI(result) {
    try {
        const userId = window.appState.currentUser.id;
        
        // Create flashcard set
        const { data: set, error: setError } = await window.supabase
            .from('flashcard_sets')
            .insert([{
                user_id: userId,
                name: `AI Generated: ${result.title}`,
                subject: 'AI Generated',
                description: `Flashcard set generated from ${result.title}`
            }])
            .select()
            .single();

        if (setError) throw setError;

        // Create flashcards
        const flashcards = result.content.flashcards.map((card, i) => ({
            set_id: set.id,
            question: card.question,
            answer: card.answer,
            order_index: i
        }));

        const { error: cardsError } = await window.supabase
            .from('flashcards')
            .insert(flashcards);

        if (cardsError) throw cardsError;

        if (window.utils?.showNotification) {
            window.utils.showNotification(`Flashcard set created with ${flashcards.length} AI-generated cards!`, 'success');
        }
        
        // Switch to flashcards section
        showSection('flashcards');
        
    } catch (error) {
        console.error('Error creating AI flashcard set:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification(`Failed to create flashcard set: ${error.message}`, 'error');
        }
    }
}

function copyToClipboard(button) {
    const content = button.parentElement.parentElement.querySelector('.ai-content').textContent;
    navigator.clipboard.writeText(content).then(() => {
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = 'Copy to Clipboard';
        }, 2000);
    });
}

// Grades functions
async function loadGrades() {
    try {
        const userId = window.appState.currentUser.id;
        
        // Get grades with assignment and class information using a simpler approach
        const { data: grades, error } = await window.supabase
            .from('grades')
            .select(`
                points,
                submissions!inner(
                    student_id,
                    assignment_id,
                    assignments!inner(
                        title,
                        max_points,
                        class_id,
                        classes!inner(name)
                    )
                )
            `)
            .eq('submissions.student_id', userId);

        const container = document.getElementById('gradesPerClass');
        if (!container) return;

        if (error) {
            console.error('Error loading grades:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Error loading grades</h3>
                    <p>${error.message}</p>
                </div>
            `;
            return;
        }

        if (!grades || grades.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No grades available</h3>
                    <p>Complete assignments to see your grades here</p>
                </div>
            `;
            return;
        }

        // Group grades by class
        const gradesByClass = {};
        grades.forEach(grade => {
            const className = grade.submissions.assignments.classes.name;
            if (!gradesByClass[className]) {
                gradesByClass[className] = [];
            }
            gradesByClass[className].push({
                title: grade.submissions.assignments.title,
                points: parseFloat(grade.points || 0),
                maxPoints: parseFloat(grade.submissions.assignments.max_points || 0),
                percentage: (parseFloat(grade.points || 0) / Math.max(parseFloat(grade.submissions.assignments.max_points || 0), 1)) * 100
            });
        });

        // Display grades by class
        container.innerHTML = Object.entries(gradesByClass).map(([className, classGrades]) => {
            const totalPoints = classGrades.reduce((sum, grade) => sum + grade.points, 0);
            const totalMaxPoints = classGrades.reduce((sum, grade) => sum + grade.maxPoints, 0);
            const classAverage = totalMaxPoints > 0 ? ((totalPoints / totalMaxPoints) * 100).toFixed(1) : 0;

            const gradeItemsHtml = classGrades.map(grade => `
                <div class="grade-item">
                    <span>${grade.title}:</span>
                    <span>${grade.percentage.toFixed(1)}% (${grade.points}/${grade.maxPoints})</span>
                </div>
            `).join('');

            return `
                <div class="grade-card">
                    <h3>${className}</h3>
                    <div class="grade-overview">
                        <div class="grade-value">${classAverage}%</div>
                    </div>
                    <div class="grade-breakdown">
                        ${gradeItemsHtml}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading grades:', error);
        const container = document.getElementById('gradesPerClass');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Error loading grades</h3>
                    <p>Please try again later</p>
                </div>
            `;
        }
    }
}

// Class homepage functions
async function openClassHomepage(classId) {
    currentClassId = classId;
    
    try {
        const { data: classInfo, error } = await window.supabase
            .from('classes')
            .select(`
                *,
                profiles!classes_teacher_id_fkey(full_name)
            `)
            .eq('id', classId)
            .single();

        if (error) throw error;

        document.getElementById('classHomepageTitle').textContent = classInfo.name;
        
        // Load overview content
        document.getElementById('classOverviewContent').innerHTML = `
            <div class="class-info">
                <h4>${classInfo.name}</h4>
                <p>${classInfo.description || 'No description available'}</p>
                <p><strong>Teacher:</strong> ${classInfo.profiles?.full_name || 'Unknown'}</p>
                <p><strong>Class Code:</strong> ${classInfo.class_code}</p>
            </div>
        `;
        
        document.getElementById('classHomepageModal').style.display = 'block';
        
        // Load class tab content
        showClassTab('overview');
        
    } catch (error) {
        console.error('Error loading class homepage:', error);
    }
}

function closeClassHomepageModal() {
    document.getElementById('classHomepageModal').style.display = 'none';
    currentClassId = null;
}

async function showClassTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.class-homepage-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(tabName.toLowerCase())) {
            btn.classList.add('active');
        }
    });
    
    // Hide all tabs
    document.querySelectorAll('.class-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`class${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`).classList.add('active');
    
    // Load tab content
    switch(tabName) {
        case 'resources':
            await loadClassResources();
            break;
        case 'assignments':
            await loadClassAssignments();
            break;
        case 'students':
            await loadClassStudents();
            break;
    }
}

async function loadClassResources() {
    try {
        // Use class_resources join to avoid class_id column issue
        const { data: classRes, error } = await window.supabase
            .from('class_resources')
            .select('*, resources!inner(*, profiles(full_name))')
            .eq('class_id', currentClassId)
            .order('id', { ascending: false });

        const container = document.getElementById('classResourcesContent');
        const resources = classRes ? classRes.map(cr => cr.resources) : [];
        if (resources.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No resources available in this class yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = resources.map(resource => `
            <div class="class-resource-item">
                <div class="resource-header">
                    <h4>${resource.title}</h4>
                    ${resource.is_official ? '<span class="official-badge">Official</span>' : ''}
                </div>
                <p>${resource.description || 'No description'}</p>
                <div class="resource-footer">
                    <span>by ${resource.profiles?.full_name}</span>
                    <div class="resource-actions">
                        <button class="btn-primary btn-small" onclick="viewResource('${resource.id}')">View</button>
                        <button class="btn-secondary btn-small" onclick="showResourceComments('${resource.id}')">Comments</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading class resources:', error);
    }
}

async function loadClassAssignments() {
    try {
        const userId = window.appState.currentUser.id;
        
        const { data: assignments, error } = await window.supabase
            .from('assignments')
            .select(`
                *,
                submissions!left(id, submitted_at, grades(points)),
                flashcard_attempts!left(score, completed_at)
            `)
            .eq('class_id', currentClassId)
            .order('due_date', { ascending: false });

        const container = document.getElementById('classAssignmentsContent');
        if (!assignments || assignments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No assignments available in this class yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = assignments.map(assignment => {
            const hasSubmission = assignment.submissions.length > 0;
            const hasFlashcardAttempt = assignment.flashcard_attempts.length > 0;
            const isCompleted = hasSubmission || hasFlashcardAttempt;
            
            return `
                <div class="class-assignment-item">
                    <div class="assignment-header">
                        <h4>${assignment.title}</h4>
                        <span class="assignment-points">${assignment.max_points} pts</span>
                    </div>
                    <p>${assignment.description}</p>
                    <div class="assignment-footer">
                        <span>Due: ${formatDateTime(assignment.due_date)}</span>
                        <span class="assignment-status ${isCompleted ? 'completed' : 'pending'}">
                            ${isCompleted ? 'Completed' : 'Pending'}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading class assignments:', error);
    }
}

async function loadClassStudents() {
    try {
        const { data: students, error } = await window.supabase
            .from('class_enrollments')
            .select(`
                profiles(full_name, email)
            `)
            .eq('class_id', currentClassId)
            .eq('is_active', true);

        const container = document.getElementById('classStudentsContent');
        if (!students || students.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No students enrolled in this class</p>
                </div>
            `;
            return;
        }

        container.innerHTML = students.map(student => `
            <div class="class-student-item">
                <h4>${student.profiles?.full_name || 'Unknown'}</h4>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading class students:', error);
    }
}

// Resource comments functions
function showResourceComments(resourceId) {
    currentResourceId = resourceId;
    loadResourceComments();
    document.getElementById('resourceCommentsModal').style.display = 'block';
}

function closeResourceCommentsModal() {
    document.getElementById('resourceCommentsModal').style.display = 'none';
    currentResourceId = null;
}

async function loadResourceComments() {
    try {
        const { data: comments, error } = await window.supabase
            .from('resource_comments')
            .select(`
                *,
                profiles(full_name)
            `)
            .eq('resource_id', currentResourceId)
            .order('created_at', { ascending: true });

        const container = document.getElementById('resourceCommentsContent');
        if (!comments || comments.length === 0) {
            container.innerHTML = '<p>No comments yet. Be the first to comment!</p>';
            return;
        }

        container.innerHTML = comments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${comment.profiles?.full_name || 'Anonymous'}</span>
                    <span class="comment-time">${formatTimeAgo(comment.created_at)}</span>
                </div>
                <div class="comment-content">${comment.comment}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

async function submitComment() {
    const textarea = document.getElementById('newCommentText');
    const content = textarea.value.trim();
    
    if (!content) return;
    
    try {
        const userId = window.appState.currentUser.id;
        
        const { error } = await window.supabase
            .from('resource_comments')
            .insert({
                resource_id: currentResourceId,
                user_id: userId,
                comment: content
            });

        if (error) throw error;

        textarea.value = '';
        await loadResourceComments();
        
        if (window.utils?.showNotification) {
            window.utils.showNotification('Comment posted!', 'success');
        }
    } catch (error) {
        console.error('Error posting comment:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to post comment', 'error');
        }
    }
}

// Utility functions
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

function formatTimeAgo(dateString) {
    if (!dateString) return 'N/A';
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function initializeEventListeners() {
    // Modal close on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Logout function
function logout() {
    if (window.supabase) {
        window.supabase.auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    } else {
        window.location.href = 'index.html';
    }
}

// Flashcard viewer functions
async function openFlashcardSet(setId) {
    try {
        const { data: cards, error } = await window.supabase
            .from('flashcards')
            .select('*')
            .eq('set_id', setId)
            .order('order_index', { ascending: true });

        if (error) throw error;

        flashcards = cards || [];
        currentFlashcardSet = setId;
        currentCardIndex = 0;

        if (flashcards.length === 0) {
            if (window.utils?.showNotification) {
                window.utils.showNotification('No cards in this set', 'warning');
            }
            return;
        }

        document.getElementById('flashcardSets').style.display = 'none';
        document.getElementById('flashcardViewer').style.display = 'block';
        
        displayCurrentCard();
    } catch (error) {
        console.error('Error loading flashcards:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to load flashcards', 'error');
        }
    }
}

function displayCurrentCard() {
    if (flashcards.length === 0) return;
    
    const card = flashcards[currentCardIndex];
    document.getElementById('cardQuestion').textContent = card.question;
    document.getElementById('cardAnswer').textContent = card.answer;
    document.getElementById('cardCounter').textContent = `${currentCardIndex + 1} / ${flashcards.length}`;
    
    // Reset flip state
    const flashcard = document.querySelector('.flashcard');
    if (flashcard) {
        flashcard.classList.remove('flipped');
    }
}

function flipCard() {
    const flashcard = document.querySelector('.flashcard');
    if (flashcard) {
        flashcard.classList.toggle('flipped');
    }
}

function nextCard() {
    if (currentCardIndex < flashcards.length - 1) {
        currentCardIndex++;
        displayCurrentCard();
    }
}

function previousCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        displayCurrentCard();
    }
}

function shuffleCards() {
    for (let i = flashcards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flashcards[i], flashcards[j]] = [flashcards[j], flashcards[i]];
    }
    currentCardIndex = 0;
    displayCurrentCard();
}

function closeFlashcardViewer() {
    document.getElementById('flashcardSets').style.display = 'grid';
    document.getElementById('flashcardViewer').style.display = 'none';
    currentFlashcardSet = null;
    currentCardIndex = 0;
    flashcards = [];
}

// Study Timer functions
let timerInterval = null;
let timerState = {
    isRunning: false,
    timeLeft: 1500, // 25 minutes in seconds
    isBreak: false,
    workDuration: 25,
    breakDuration: 5,
    sessionsCompleted: 0,
    totalStudyTime: 0
};

function initializeTimer() {
    // Load settings
    const workInput = document.getElementById('workDuration');
    const breakInput = document.getElementById('breakDuration');
    
    if (workInput) {
        workInput.addEventListener('change', (e) => {
            timerState.workDuration = parseInt(e.target.value) || 25;
            if (!timerState.isRunning && !timerState.isBreak) {
                timerState.timeLeft = timerState.workDuration * 60;
                updateTimerDisplay();
            }
        });
    }
    
    if (breakInput) {
        breakInput.addEventListener('change', (e) => {
            timerState.breakDuration = parseInt(e.target.value) || 5;
            if (!timerState.isRunning && timerState.isBreak) {
                timerState.timeLeft = timerState.breakDuration * 60;
                updateTimerDisplay();
            }
        });
    }
    
    // Load saved stats from localStorage
    const savedStats = localStorage.getItem('pomodoroStats');
    if (savedStats) {
        const stats = JSON.parse(savedStats);
        const today = new Date().toDateString();
        if (stats.date === today) {
            timerState.sessionsCompleted = stats.sessionsCompleted || 0;
            timerState.totalStudyTime = stats.totalStudyTime || 0;
            updateTimerStats();
        }
    }
    
    updateTimerDisplay();
}

function toggleTimer() {
    if (timerState.isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    timerState.isRunning = true;
    const timerBtn = document.getElementById('timerBtn');
    if (timerBtn) {
        timerBtn.textContent = 'Pause';
        timerBtn.classList.add('btn-warning');
        timerBtn.classList.remove('btn-primary');
    }
    
    timerInterval = setInterval(() => {
        timerState.timeLeft--;
        updateTimerDisplay();
        
        if (timerState.timeLeft <= 0) {
            completeTimerSession();
        }
    }, 1000);
}

function pauseTimer() {
    timerState.isRunning = false;
    clearInterval(timerInterval);
    
    const timerBtn = document.getElementById('timerBtn');
    if (timerBtn) {
        timerBtn.textContent = 'Resume';
        timerBtn.classList.remove('btn-warning');
        timerBtn.classList.add('btn-primary');
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    timerState.isRunning = false;
    timerState.isBreak = false;
    timerState.timeLeft = timerState.workDuration * 60;
    
    const timerBtn = document.getElementById('timerBtn');
    if (timerBtn) {
        timerBtn.textContent = 'Start';
        timerBtn.classList.remove('btn-warning');
        timerBtn.classList.add('btn-primary');
    }
    
    updateTimerDisplay();
}

function completeTimerSession() {
    clearInterval(timerInterval);
    timerState.isRunning = false;
    
    if (!timerState.isBreak) {
        // Work session completed
        timerState.sessionsCompleted++;
        timerState.totalStudyTime += timerState.workDuration;
        timerState.isBreak = true;
        timerState.timeLeft = timerState.breakDuration * 60;
        
        if (window.utils?.showNotification) {
            window.utils.showNotification('Work session complete! Time for a break.', 'success');
        }
        
        // Play notification sound if available
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl+zOzXmkoFHTGO2vG2ZR4HS5bb8M16KwMwe9LwqoVDCh9BsOvytGEZBz2b4NWnVBIDRrHz0IA');
            audio.play();
        } catch (e) {}
    } else {
        // Break session completed
        timerState.isBreak = false;
        timerState.timeLeft = timerState.workDuration * 60;
        
        if (window.utils?.showNotification) {
            window.utils.showNotification('Break complete! Ready for another session?', 'info');
        }
    }
    
    updateTimerDisplay();
    updateTimerStats();
    saveTimerStats();
    
    const timerBtn = document.getElementById('timerBtn');
    if (timerBtn) {
        timerBtn.textContent = 'Start';
        timerBtn.classList.remove('btn-warning');
        timerBtn.classList.add('btn-primary');
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerState.timeLeft / 60);
    const seconds = timerState.timeLeft % 60;
    
    const timeDisplay = document.getElementById('timerTime');
    if (timeDisplay) {
        timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    const labelDisplay = document.getElementById('timerLabel');
    if (labelDisplay) {
        labelDisplay.textContent = timerState.isBreak ? 'Break Time' : 'Work Session';
    }
    
    // Update progress circle
    const progress = document.getElementById('timerProgress');
    if (progress) {
        const totalTime = timerState.isBreak ? timerState.breakDuration * 60 : timerState.workDuration * 60;
        const percentage = (timerState.timeLeft / totalTime) * 100;
        const circumference = 2 * Math.PI * 45;
        const offset = circumference - (percentage / 100) * circumference;
        progress.style.strokeDasharray = circumference;
        progress.style.strokeDashoffset = offset;
    }
}

function updateTimerStats() {
    const sessionsEl = document.getElementById('sessionsCompleted');
    if (sessionsEl) {
        sessionsEl.textContent = timerState.sessionsCompleted;
    }
    
    const totalTimeEl = document.getElementById('totalStudyTime');
    if (totalTimeEl) {
        const hours = Math.floor(timerState.totalStudyTime / 60);
        const minutes = timerState.totalStudyTime % 60;
        totalTimeEl.textContent = `${hours}h ${minutes}m`;
    }
}

function saveTimerStats() {
    const stats = {
        date: new Date().toDateString(),
        sessionsCompleted: timerState.sessionsCompleted,
        totalStudyTime: timerState.totalStudyTime
    };
    localStorage.setItem('pomodoroStats', JSON.stringify(stats));
}

// AI Assistant functions
async function loadAIResources() {
    try {
        const userId = window.appState.currentUser.id;
        
        // Load all user's resources
        const { data: resources, error } = await window.supabase
            .from('resources')
            .select('id, title, file_name, resource_type, description, file_url')
            .eq('user_id', userId)
            .order('id', { ascending: false });

        const container = document.getElementById('aiResourcesList');
        if (!container) return;

        if (error || !resources || resources.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No resources available</h3>
                    <p>Upload resources to use the AI assistant</p>
                </div>
            `;
            return;
        }

        container.innerHTML = resources.map(resource => `
            <div class="ai-resource-card">
                <div class="ai-resource-info">
                    <h4>${resource.title || resource.file_name}</h4>
                    <p>${resource.description || 'No description'}</p>
                    <span class="resource-type">${resource.resource_type || 'document'}</span>
                </div>
                <button class="btn-primary btn-small" onclick="analyzeResource('${resource.id}', '${(resource.title || resource.file_name).replace(/'/g, "\\'")}')">Analyze with AI</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading AI resources:', error);
    }
}

async function analyzeResource(resourceId, resourceName) {
    try {
        // Get resource details
        const { data: resource, error } = await window.supabase
            .from('resources')
            .select('file_url, title, description')
            .eq('id', resourceId)
            .single();

        if (error) throw error;

        // Show results section
        document.getElementById('aiResourcesList').parentElement.style.display = 'none';
        const resultsDiv = document.getElementById('aiResults');
        resultsDiv.style.display = 'block';
        
        document.getElementById('selectedResourceName').textContent = resourceName;
        
        // Initialize loading states
        const summaryDiv = document.getElementById('documentSummary');
        const planDiv = document.getElementById('studyPlan');
        const flashcardsDiv = document.getElementById('suggestedFlashcards');
        
        summaryDiv.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>Analyzing document with AI...</p></div>';
        planDiv.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>Creating personalized study plan...</p></div>';
        flashcardsDiv.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>Generating flashcards...</p></div>';
        
        try {
            // Initialize AI service if not already done
            if (!window.aiService) {
                // Load the AI service script if not already loaded
                if (typeof AIService === 'undefined') {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = './js/ai-service.js';
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }
                window.aiService = new AIService();
            }

            // Get the resource file URL
            let fileUrl = resource.file_url;
            if (!fileUrl.startsWith('http')) {
                // If it's a storage path, get the public URL
                const { data: urlData } = window.supabase.storage
                    .from('study-hub')
                    .getPublicUrl(resource.file_url);
                fileUrl = urlData.publicUrl;
            }

            // Process the resource with AI service
            const aiResponse = await window.aiService.processResourceFromUrl(
                fileUrl, 
                'comprehensive', 
                resource.title || resourceName || 'Study Resource'
            );

            if (aiResponse.error) {
                throw new Error(aiResponse.error);
            }

            // Update summary
            summaryDiv.innerHTML = aiResponse.summary ? 
                `<div class="ai-content">${aiResponse.summary}</div>` : 
                '<div class="ai-error">No summary could be generated for this resource.</div>';
            
            // Update study plan
            if (aiResponse.studyPlan) {
                planDiv.innerHTML = `<div class="ai-content">${aiResponse.studyPlan}</div>`;
            } else {
                planDiv.innerHTML = '<div class="ai-error">No study plan could be generated for this resource.</div>';
            }
            
            // Update flashcards
            if (aiResponse.flashcards && aiResponse.flashcards.length > 0) {
                const flashcardsHtml = aiResponse.flashcards.map(card => 
                    `<div class="flashcard-preview">
                        <div class="flashcard-q"><strong>Q:</strong> ${card.question}</div>
                        <div class="flashcard-a"><strong>A:</strong> ${card.answer}</div>
                    </div>`
                ).join('');
                flashcardsDiv.innerHTML = `
                    <div class="ai-content">
                        ${flashcardsHtml}
                    </div>
                `;
            } else {
                flashcardsDiv.innerHTML = '<div class="ai-error">No flashcards could be generated for this resource.</div>';
            }

        } catch (aiError) {
            console.error('AI processing error:', aiError);
            
            let errorMessage = 'Unable to process this resource with AI.';
            if (aiError.message.includes('API key')) {
                errorMessage = 'AI service is not configured. Please check the API key setup.';
            } else if (aiError.message.includes('fetch') || aiError.message.includes('network')) {
                errorMessage = 'Unable to access the resource file. Please check file availability.';
            } else if (aiError.message.includes('quota') || aiError.message.includes('limit')) {
                errorMessage = 'AI service quota exceeded. Please try again later.';
            }
            
            summaryDiv.innerHTML = `<div class="ai-error">${errorMessage}</div>`;
            planDiv.innerHTML = `<div class="ai-error">${errorMessage}</div>`;
            flashcardsDiv.innerHTML = `<div class="ai-error">${errorMessage}</div>`;
        }
        
    } catch (error) {
        console.error('Error analyzing resource:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to analyze resource', 'error');
        }
    }
}

function closeAIResults() {
    document.getElementById('aiResults').style.display = 'none';
    document.getElementById('aiResourcesList').parentElement.style.display = 'block';
}

// Delete resource function
async function deleteResource(resourceId) {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    
    try {
        const { error } = await window.supabase
            .from('resources')
            .delete()
            .eq('id', resourceId)
            .eq('user_id', window.appState.currentUser.id);

        if (error) throw error;

        if (window.utils?.showNotification) {
            window.utils.showNotification('Resource deleted successfully', 'success');
        }
        await loadResources();
    } catch (error) {
        console.error('Error deleting resource:', error);
        if (window.utils?.showNotification) {
            window.utils.showNotification('Failed to delete resource', 'error');
        }
    }
}

// Global function exposure for inline handlers
window.showSection = showSection;
window.showJoinClassModal = showJoinClassModal;
window.closeJoinClassModal = closeJoinClassModal;
window.handleJoinClass = handleJoinClass;
window.showUploadModal = showUploadModal;
window.closeUploadModal = closeUploadModal;
window.handleResourceUpload = handleResourceUpload;
window.showCreateFlashcardModal = showCreateFlashcardModal;
window.closeCreateFlashcardModal = closeCreateFlashcardModal;
window.handleCreateFlashcardSet = handleCreateFlashcardSet;
window.addFlashcardInput = addFlashcardInput;
window.removeFlashcardInput = removeFlashcardInput;
window.openFlashcardSet = openFlashcardSet;
window.flipCard = flipCard;
window.nextCard = nextCard;
window.previousCard = previousCard;
window.shuffleCards = shuffleCards;
window.closeFlashcardViewer = closeFlashcardViewer;
window.toggleTimer = toggleTimer;
window.resetTimer = resetTimer;
window.openClassHomepage = openClassHomepage;
window.closeClassHomepageModal = closeClassHomepageModal;
window.showClassTab = showClassTab;
window.viewResource = viewResource;
window.deleteResource = deleteResource;
window.showResourceComments = showResourceComments;
window.closeResourceCommentsModal = closeResourceCommentsModal;
window.submitComment = submitComment;
window.logout = logout;
window.showAssignments = showAssignments;
window.submitAssignment = submitAssignment;
window.closeAssignmentSubmissionModal = closeAssignmentSubmissionModal;
window.handleAssignmentSubmission = handleAssignmentSubmission;
window.viewFeedback = viewFeedback;
window.closeFeedbackModal = closeFeedbackModal;
window.startFlashcardAssignment = startFlashcardAssignment;
window.filterResources = filterResources;
window.showResourceType = showResourceType;
window.loadClasses = loadClasses;
window.analyzeResource = analyzeResource;
window.closeAIResults = closeAIResults;
window.loadAIResources = loadAIResources;
window.loadGrades = loadGrades;
window.submitAssignment = submitAssignment;
window.closeAssignmentSubmissionModal = closeAssignmentSubmissionModal;
window.handleAssignmentSubmission = handleAssignmentSubmission;
window.startFlashcardAssignment = startFlashcardAssignment;
window.submitFlashcardAnswer = submitFlashcardAnswer;
window.nextFlashcardQuestion = nextFlashcardQuestion;
window.closeFlashcardAssignmentModal = closeFlashcardAssignmentModal;
window.viewFeedback = viewFeedback;
window.closeFeedbackModal = closeFeedbackModal;
window.showAssignments = showAssignments;
window.generateAIContent = generateAIContent;
window.createFlashcardSetFromAI = createFlashcardSetFromAI;
window.copyToClipboard = copyToClipboard;
window.openClassHomepage = openClassHomepage;
window.closeClassHomepageModal = closeClassHomepageModal;
window.showClassTab = showClassTab;
window.showResourceComments = showResourceComments;
window.closeResourceCommentsModal = closeResourceCommentsModal;
window.submitComment = submitComment;
window.viewResource = viewResource;
window.showResourceType = showResourceType;
window.filterResources = filterResources;
window.logout = logout;

console.log('✅ Student dashboard script loaded successfully');
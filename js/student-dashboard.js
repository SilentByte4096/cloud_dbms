// Student Dashboard JavaScript - Fixed Version

// State management
let currentSection = 'overview';
let currentFlashcardSet = null;
let currentCardIndex = 0;
let timerInterval = null;
let timerState = {
    isRunning: false,
    timeLeft: 1500, // 25 minutes in seconds
    isBreak: false,
    workDuration: 25,
    breakDuration: 5
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadUserInfo();
    await loadDashboardData();
    initializeEventListeners();
    initializeTimer();
});

// Load user information
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
            <p>Student</p>
        `;
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Load dashboard overview data
async function loadDashboardData() {
    try {
        const userId = window.appState.currentUser.id;
        
        // Load stats
        const [resources, assignments, flashcardSets, studySessions] = await Promise.all([
            window.supabase.from('resources').select('id').eq('user_id', userId),
            window.supabase.from('assignments').select('id, submissions!inner(student_id)').eq('submissions.student_id', userId),
            window.supabase.from('flashcard_sets').select('id').eq('user_id', userId),
            window.supabase.from('study_sessions').select('duration_minutes').eq('user_id', userId).eq('completed', true)
        ]);

        // Update stats
        document.getElementById('resourceCount').textContent = resources.data?.length || 0;
        document.getElementById('assignmentCount').textContent = assignments.data?.length || 0;
        document.getElementById('flashcardCount').textContent = flashcardSets.data?.length || 0;
        
        const totalMinutes = studySessions.data?.reduce((sum, session) => sum + session.duration_minutes, 0) || 0;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        document.getElementById('studyHours').textContent = `${hours}h ${minutes}m`;

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
            .from('resources')
            .select('id, title, created_at, resource_type')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        const activityList = document.getElementById('recentActivity');
        if (activities.length === 0) {
            window.utils.showEmptyState(activityList, 'No recent activity', 'Start uploading resources to see your activity here');
            return;
        }

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">${getResourceIcon(activity.resource_type)}</div>
                <div class="activity-content">
                    <h4>${activity.title}</h4>
                    <p>${window.utils.formatTimeAgo(activity.created_at)}</p>
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
    document.getElementById(sectionName).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
    
    currentSection = sectionName;
    
    // Load section-specific data
    switch(sectionName) {
        case 'resources':
            loadResources();
            loadSubjectsFilter();
            break;
        case 'assignments':
            loadAssignments();
            break;
        case 'flashcards':
            loadFlashcardSets();
            break;
        case 'ai-assistant':
            loadUserResourcesForAI();
            break;
        case 'grades':
            loadGrades();
            break;
    }
}

// Resources functions
async function loadResources() {
    try {
        window.utils.showLoading(document.getElementById('resourcesGrid'));
        
        const { data: resources, error } = await window.supabase
            .from('resources')
            .select(`
                *,
                subjects(name),
                chapters(name),
                profiles(full_name)
            `)
            .eq('is_public', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        displayResources(resources);
    } catch (error) {
        console.error('Error loading resources:', error);
        window.utils.showNotification('Failed to load resources', 'error');
    }
}

function displayResources(resources) {
    const grid = document.getElementById('resourcesGrid');
    
    if (resources.length === 0) {
        window.utils.showEmptyState(grid, 'No resources found', 'Upload your first resource to get started');
        return;
    }

    grid.innerHTML = resources.map(resource => `
        <div class="resource-card">
            <div class="resource-header">
                <h3>${resource.title}</h3>
                <div class="resource-meta">
                    <span>${resource.subjects?.name || 'General'}</span>
                    <span class="resource-type">${resource.resource_type}</span>
                </div>
                <div class="resource-meta">
                    <span>${resource.chapters?.name || 'General'}</span>
                    <span>by ${resource.profiles?.full_name}</span>
                </div>
            </div>
            <div class="resource-body">
                <div class="resource-description">
                    ${resource.description || 'No description available'}
                </div>
                <div class="resource-actions">
                    <div class="resource-rating">
                        <span class="rating-stars">${'★'.repeat(Math.floor(resource.rating_avg || 0))}${'☆'.repeat(5 - Math.floor(resource.rating_avg || 0))}</span>
                        <span>(${resource.rating_count || 0})</span>
                    </div>
                    <div>
                        <button class="btn-secondary btn-small" onclick="viewResource('${resource.id}')">View</button>
                        <button class="btn-primary btn-small" onclick="rateResource('${resource.id}')">Rate</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadSubjectsFilter() {
    try {
        const { data: subjects } = await window.supabase
            .from('subjects')
            .select('*')
            .order('name');

        const subjectFilter = document.getElementById('subjectFilter');
        if (subjectFilter) {
            subjectFilter.innerHTML = '<option value="">All Subjects</option>' +
                subjects.map(subject => `<option value="${subject.id}">${subject.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
    }
}

async function loadChaptersFilter(subjectId) {
    try {
        const chapterFilter = document.getElementById('chapterFilter');
        if (!chapterFilter) return;

        if (!subjectId) {
            chapterFilter.innerHTML = '<option value="">All Chapters</option>';
            return;
        }

        const { data: chapters } = await window.supabase
            .from('chapters')
            .select('*')
            .eq('subject_id', subjectId)
            .order('order_index');

        chapterFilter.innerHTML = '<option value="">All Chapters</option>' +
            chapters.map(chapter => `<option value="${chapter.id}">${chapter.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading chapters:', error);
    }
}

async function filterResources() {
    const subjectFilter = document.getElementById('subjectFilter');
    const chapterFilter = document.getElementById('chapterFilter');
    const typeFilter = document.getElementById('typeFilter');
    
    if (!subjectFilter || !chapterFilter || !typeFilter) {
        console.error('Filter elements not found');
        return;
    }

    const subjectId = subjectFilter.value;
    const chapterId = chapterFilter.value;
    const type = typeFilter.value;

    // Load chapters when subject changes
    if (event && event.target && event.target.id === 'subjectFilter') {
        await loadChaptersFilter(subjectId);
    }

    let query = window.supabase
        .from('resources')
        .select(`
            *,
            subjects(name),
            chapters(name),
            profiles(full_name)
        `)
        .eq('is_public', true);

    if (subjectId) query = query.eq('subject_id', subjectId);
    if (chapterId) query = query.eq('chapter_id', chapterId);
    if (type) query = query.eq('resource_type', type);

    try {
        const { data: resources, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        displayResources(resources);
    } catch (error) {
        console.error('Error filtering resources:', error);
        window.utils.showNotification('Failed to filter resources', 'error');
    }
}

// Resource upload modal
function showUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
        modal.style.display = 'block';
        loadSubjectsForUpload();
    }
}

function closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
        modal.style.display = 'none';
        const form = modal.querySelector('form');
        if (form) form.reset();
        
        // Clean up dynamic selects
        const existingSelects = ['resourceSubjectSelect', 'resourceChapterSelect'];
        existingSelects.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.remove();
        });
    }
}

async function loadSubjectsForUpload() {
    try {
        const { data: subjects } = await window.supabase
            .from('subjects')
            .select('*')
            .order('name');

        // Remove existing select if it exists
        const existingSelect = document.getElementById('resourceSubjectSelect');
        if (existingSelect) existingSelect.remove();

        const subjectInput = document.getElementById('resourceSubject');
        if (!subjectInput) return;

        const subjectSelect = document.createElement('select');
        subjectSelect.id = 'resourceSubjectSelect';
        subjectSelect.className = 'form-control';
        subjectSelect.innerHTML = '<option value="">Select existing subject</option>' +
            subjects.map(subject => `<option value="${subject.id}">${subject.name}</option>`).join('');
        
        subjectSelect.onchange = async (e) => {
            if (e.target.value) {
                const selectedSubject = subjects.find(s => s.id === e.target.value);
                if (selectedSubject) {
                    subjectInput.value = selectedSubject.name;
                    await loadChaptersForUpload(e.target.value);
                }
            } else {
                subjectInput.value = '';
                // Remove chapter select when no subject is selected
                const chapterSelect = document.getElementById('resourceChapterSelect');
                if (chapterSelect) chapterSelect.remove();
                const chapterInput = document.getElementById('resourceChapter');
                if (chapterInput) chapterInput.value = '';
            }
        };
        
        subjectInput.parentNode.insertBefore(subjectSelect, subjectInput.nextSibling);
    } catch (error) {
        console.error('Error loading subjects for upload:', error);
    }
}

async function loadChaptersForUpload(subjectId) {
    try {
        const { data: chapters } = await window.supabase
            .from('chapters')
            .select('*')
            .eq('subject_id', subjectId)
            .order('order_index');

        // Remove existing select if it exists
        const existingSelect = document.getElementById('resourceChapterSelect');
        if (existingSelect) existingSelect.remove();

        const chapterInput = document.getElementById('resourceChapter');
        if (!chapterInput) return;

        const chapterSelect = document.createElement('select');
        chapterSelect.id = 'resourceChapterSelect';
        chapterSelect.className = 'form-control';
        chapterSelect.innerHTML = '<option value="">Select existing chapter</option>' +
            chapters.map(chapter => `<option value="${chapter.id}">${chapter.name}</option>`).join('');
        
        chapterSelect.onchange = (e) => {
            if (e.target.value) {
                const selectedChapter = chapters.find(c => c.id === e.target.value);
                if (selectedChapter) {
                    chapterInput.value = selectedChapter.name;
                }
            } else {
                chapterInput.value = '';
            }
        };
        
        chapterInput.parentNode.insertBefore(chapterSelect, chapterInput.nextSibling);
    } catch (error) {
        console.error('Error loading chapters for upload:', error);
    }
}

async function handleResourceUpload(event) {
    event.preventDefault();
    
    try {
        const userId = window.appState.currentUser.id;
        const titleInput = document.getElementById('resourceTitle');
        const subjectInput = document.getElementById('resourceSubject');
        const chapterInput = document.getElementById('resourceChapter');
        const typeInput = document.getElementById('resourceType');
        const descriptionInput = document.getElementById('resourceDescription');
        const fileInput = document.getElementById('resourceFile');

        // Validate required inputs exist
        if (!titleInput || !typeInput || !fileInput) {
            window.utils.showNotification('Form elements not found', 'error');
            return;
        }

        const title = titleInput.value.trim();
        const subject = subjectInput ? subjectInput.value.trim() : '';
        const chapter = chapterInput ? chapterInput.value.trim() : '';
        const type = typeInput.value;
        const description = descriptionInput ? descriptionInput.value.trim() : '';
        const file = fileInput.files[0];

        // Validate required fields
        if (!title) {
            window.utils.showNotification('Please enter a title', 'error');
            titleInput.focus();
            return;
        }

        if (!type) {
            window.utils.showNotification('Please select a resource type', 'error');
            typeInput.focus();
            return;
        }

        if (!file) {
            window.utils.showNotification('Please select a file', 'error');
            fileInput.focus();
            return;
        }

        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        try {
            // Upload file to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await window.supabase.storage
                .from('resources')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // Get or create subject
            let subjectId = null;
            if (subject) {
                const { data: existingSubject } = await window.supabase
                    .from('subjects')
                    .select('id')
                    .eq('name', subject)
                    .maybeSingle();

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
                    .maybeSingle();

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
                .from('resources')
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
                    file_size: file.size
                }])
                .select('id')
                .single();

            if (resourceError) throw resourceError;

            // Create initial version
            await window.supabase
                .from('resource_versions')
                .insert([{
                    resource_id: resourceData.id,
                    version: 1,
                    file_url: urlData.publicUrl,
                    file_name: file.name,
                    file_size: file.size,
                    uploaded_by: userId,
                    upload_notes: 'Initial version'
                }]);

            window.utils.showNotification('Resource uploaded successfully!', 'success');
            closeUploadModal();
            await loadResources();
            await loadDashboardData();
        } finally {
            // Reset button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error uploading resource:', error);
        window.utils.showNotification(`Failed to upload resource: ${error.message}`, 'error');
    }
}

// Join Class functions
function showJoinClassModal() {
    const modal = document.getElementById('joinClassModal');
    if (modal) {
        modal.style.display = 'block';
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
    if (!classCodeInput) {
        window.utils.showNotification('Form element not found', 'error');
        return;
    }
    
    const classCode = classCodeInput.value.trim().toUpperCase();
    if (!classCode) {
        window.utils.showNotification('Please enter a class code', 'error');
        classCodeInput.focus();
        return;
    }
    
    try {
        const userId = window.appState.currentUser.id;
        
        // Find the class by class code
        const { data: classData, error: classError } = await window.supabase
            .from('classes')
            .select('*')
            .eq('class_code', classCode)
            .single();
        
        if (classError) {
            if (classError.code === 'PGRST116') {
                window.utils.showNotification('Class not found. Please check the class code.', 'error');
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
            .maybeSingle();
        
        if (existingEnrollment) {
            window.utils.showNotification('You are already enrolled in this class', 'warning');
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
        
        window.utils.showNotification(`Successfully joined "${classData.name}"!`, 'success');
        closeJoinClassModal();
        
        // Reload assignments to show new class assignments
        await loadAssignments();
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error joining class:', error);
        window.utils.showNotification(`Failed to join class: ${error.message}`, 'error');
    }
}

// Assignments functions
async function loadAssignments(status = 'pending') {
    try {
        const userId = window.appState.currentUser.id;
        
        // Get enrolled classes
        const { data: enrollments } = await window.supabase
            .from('class_enrollments')
            .select('class_id')
            .eq('student_id', userId);

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

        let query = window.supabase
            .from('assignments')
            .select(`
                *,
                classes(name),
                submissions!left(id, submitted_at, grades(points, feedback, graded_at))
            `)
            .in('class_id', classIds)
            .order('due_date', { ascending: true });

        const { data: assignments, error } = await query;
        if (error) throw error;

        const now = new Date();
        let filteredAssignments = [];

        assignments.forEach(assignment => {
            const dueDate = new Date(assignment.due_date);
            const hasSubmission = assignment.submissions.length > 0;
            const hasGrade = hasSubmission && assignment.submissions[0].grades && assignment.submissions[0].grades.length > 0;

            if (status === 'pending' && !hasSubmission && dueDate > now) {
                filteredAssignments.push({ ...assignment, status: 'pending' });
            } else if (status === 'submitted' && hasSubmission && !hasGrade) {
                filteredAssignments.push({ ...assignment, status: 'submitted' });
            } else if (status === 'graded' && hasGrade) {
                filteredAssignments.push({ ...assignment, status: 'graded' });
            }
        });

        displayAssignments(filteredAssignments);
    } catch (error) {
        console.error('Error loading assignments:', error);
        window.utils.showNotification('Failed to load assignments', 'error');
    }
}

function displayAssignments(assignments) {
    const container = document.getElementById('assignmentsList');
    if (!container) return;
    
    if (assignments.length === 0) {
        window.utils.showEmptyState(container, 'No assignments', 'No assignments found for this category');
        return;
    }

    container.innerHTML = assignments.map(assignment => `
        <div class="assignment-card">
            <div class="assignment-header">
                <div>
                    <h3 class="assignment-title">${assignment.title}</h3>
                    <div class="assignment-meta">
                        Class: ${assignment.classes.name} | Due: ${window.utils.formatDateTime(assignment.due_date)} | Points: ${assignment.max_points}
                    </div>
                </div>
                <div class="assignment-status status-${assignment.status}">${assignment.status}</div>
            </div>
            <div class="assignment-description">${assignment.description}</div>
            <div class="assignment-actions">
                ${assignment.status === 'pending' ? `
                    <button class="btn-primary btn-small" onclick="submitAssignment('${assignment.id}')">Submit</button>
                ` : assignment.status === 'graded' ? `
                    <span class="grade-display">Grade: ${assignment.submissions[0].grades[0].points}/${assignment.max_points}</span>
                    <button class="btn-secondary btn-small" onclick="viewFeedback('${assignment.id}')">View Feedback</button>
                ` : `
                    <span class="submitted-info">Submitted on ${window.utils.formatDate(assignment.submissions[0].submitted_at)}</span>
                `}
            </div>
        </div>
    `).join('');
}

function showAssignments(status) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    loadAssignments(status);
}

// Flashcards functions - FIXED VERSION
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
        
        if (sets.length === 0) {
            window.utils.showEmptyState(container, 'No flashcard sets', 'Create your first flashcard set to start studying');
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
        window.utils.showNotification('Failed to load flashcard sets', 'error');
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
        const setNameInput = document.getElementById('flashcardSetName');
        const subjectInput = document.getElementById('flashcardSubject');
        
        if (!setNameInput || !subjectInput) {
            window.utils.showNotification('Form elements not found', 'error');
            return;
        }

        const setName = setNameInput.value.trim();
        const subject = subjectInput.value.trim();
        
        if (!setName) {
            window.utils.showNotification('Please enter a flashcard set name', 'error');
            setNameInput.focus();
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
                    subject: subject || 'General',
                    description: `Flashcard set for ${subject || 'general study'}`
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
                window.utils.showNotification('Please add at least one complete flashcard (question and answer)', 'error');
                return;
            }

            const { error: cardsError } = await window.supabase
                .from('flashcards')
                .insert(flashcards);

            if (cardsError) throw cardsError;

            window.utils.showNotification(`Flashcard set created with ${flashcards.length} cards!`, 'success');
            closeCreateFlashcardModal();
            await loadFlashcardSets();
            await loadDashboardData();
        } finally {
            // Reset button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error creating flashcard set:', error);
        window.utils.showNotification(`Failed to create flashcard set: ${error.message}`, 'error');
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

        if (cards.length === 0) {
            window.utils.showNotification('This flashcard set is empty', 'warning');
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
        window.utils.showNotification('Failed to open flashcard set', 'error');
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
    window.utils.showNotification('Cards shuffled!', 'success');
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

        window.utils.showNotification(
            timerState.isBreak ? 'Break complete!' : 'Work session complete!', 
            'success'
        );
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

        const workSessions = sessions.filter(s => s.session_type === 'work');
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

// Update timer settings with null checks
function initializeTimerSettings() {
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

// AI Assistant functions
async function loadUserResourcesForAI() {
    try {
        const userId = window.appState.currentUser.id;
        
        const { data: resources, error } = await window.supabase
            .from('resources')
            .select(`
                *,
                subjects(name),
                chapters(name)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('aiResourcesList');
        if (!container) return;
        
        if (resources.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <h3>No Resources Yet</h3>
                    <p>Upload some resources first to use AI analysis</p>
                    <button class="btn-primary" onclick="showSection('resources')">Go to Resources</button>
                </div>
            `;
            return;
        }

        container.innerHTML = resources.map(resource => `
            <div class="ai-resource-card" onclick="analyzeResource('${resource.id}', '${resource.title}')">
                <div class="ai-resource-type">${resource.resource_type}</div>
                <h4>${resource.title}</h4>
                <div class="ai-resource-meta">
                    ${resource.subjects?.name || 'General'} ${resource.chapters?.name ? ' • ' + resource.chapters.name : ''}
                </div>
                <div class="ai-resource-meta">
                    ${window.utils.formatTimeAgo(resource.created_at)}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading resources for AI:', error);
        window.utils.showNotification('Failed to load resources', 'error');
    }
}

function analyzeResource(resourceId, resourceTitle) {
    // Show AI results
    const aiResults = document.getElementById('aiResults');
    const resourcesList = document.getElementById('aiResourcesList');
    const selectedResourceName = document.getElementById('selectedResourceName');
    
    if (aiResults) aiResults.style.display = 'block';
    if (resourcesList) resourcesList.parentElement.style.display = 'none';
    if (selectedResourceName) selectedResourceName.textContent = resourceTitle;
    
    // Show loading states
    const documentSummary = document.getElementById('documentSummary');
    const studyPlan = document.getElementById('studyPlan');
    const suggestedFlashcards = document.getElementById('suggestedFlashcards');
    
    if (documentSummary) {
        documentSummary.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Analyzing document...</p>
        `;
    }
    
    if (studyPlan) {
        studyPlan.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Generating study plan...</p>
        `;
    }
    
    if (suggestedFlashcards) {
        suggestedFlashcards.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Creating flashcard suggestions...</p>
        `;
    }

    // Simulate API delay
    setTimeout(() => {
        const summary = generatePlaceholderSummary(resourceTitle);
        const plan = generatePlaceholderStudyPlan(resourceTitle);
        const flashcards = generatePlaceholderFlashcards(resourceTitle);
        
        if (documentSummary) documentSummary.innerHTML = summary;
        if (studyPlan) studyPlan.innerHTML = plan;
        if (suggestedFlashcards) suggestedFlashcards.innerHTML = flashcards;

        // Save to database
        saveAISummary(resourceId, resourceTitle, summary, plan, flashcards);
    }, 3000);
}

function closeAIResults() {
    const aiResults = document.getElementById('aiResults');
    const resourcesList = document.getElementById('aiResourcesList');
    
    if (aiResults) aiResults.style.display = 'none';
    if (resourcesList) resourcesList.parentElement.style.display = 'block';
}

function generatePlaceholderSummary(fileName) {
    const summaries = [
        "This document covers fundamental concepts in computer science, including data structures, algorithms, and programming paradigms. Key topics include array manipulation, sorting algorithms, and object-oriented programming principles.",
        "The document provides an overview of mathematical concepts including calculus, algebra, and statistics. It covers derivative calculations, integral applications, and probability distributions with practical examples.",
        "This material focuses on scientific principles and methodologies. It discusses experimental design, data analysis techniques, and theoretical frameworks commonly used in research."
    ];
    
    return summaries[Math.floor(Math.random() * summaries.length)];
}

function generatePlaceholderStudyPlan(fileName) {
    return `
        <h4>Recommended Study Plan for "${fileName}"</h4>
        <ol>
            <li><strong>Week 1-2:</strong> Review fundamental concepts and terminology from the resource</li>
            <li><strong>Week 3-4:</strong> Practice problem-solving with basic examples covered in the material</li>
            <li><strong>Week 5-6:</strong> Work through intermediate exercises and case studies</li>
            <li><strong>Week 7-8:</strong> Complete advanced problems and review challenging areas</li>
        </ol>
        <h4>Study Tips</h4>
        <ul>
            <li>Create flashcards for key terms and concepts from this resource</li>
            <li>Use the Pomodoro technique for focused study sessions</li>
            <li>Practice explaining concepts to others</li>
            <li>Take regular breaks and review material multiple times</li>
            <li>Create connections between this resource and your other study materials</li>
        </ul>
    `;
}

function generatePlaceholderFlashcards(resourceTitle) {
    const flashcardSets = [
        {
            topic: "Key Concepts",
            cards: [
                { question: "What is the main topic covered in this resource?", answer: "Based on '" + resourceTitle + "', this covers fundamental concepts in the subject area." },
                { question: "What are the key learning objectives?", answer: "Understanding core principles, practical applications, and problem-solving techniques." },
                { question: "How does this topic relate to other subjects?", answer: "This material connects to multiple areas of study and builds foundational knowledge." }
            ]
        },
        {
            topic: "Practical Applications",
            cards: [
                { question: "Where can these concepts be applied?", answer: "Real-world scenarios, academic projects, and professional environments." },
                { question: "What are common misconceptions about this topic?", answer: "Students often confuse theoretical concepts with practical implementations." }
            ]
        }
    ];
    
    let html = '';
    flashcardSets.forEach(set => {
        html += `<h4>${set.topic}</h4><div class="flashcard-preview-grid">`;
        set.cards.forEach((card, index) => {
            html += `
                <div class="flashcard-preview">
                    <div class="flashcard-preview-front">
                        <strong>Q:</strong> ${card.question}
                    </div>
                    <div class="flashcard-preview-back">
                        <strong>A:</strong> ${card.answer}
                    </div>
                </div>
            `;
        });
        html += '</div>';
    });
    
    return html;
}

let currentAISuggestedCards = [];

function createFlashcardsFromAI() {
    // This would create flashcards from the AI suggestions
    const resourceTitle = document.getElementById('selectedResourceName')?.textContent || 'AI Generated';
    
    // Create a flashcard set with AI suggested cards
    const setName = `AI Study Cards - ${resourceTitle}`;
    
    window.utils.showNotification('Creating flashcard set from AI suggestions...', 'info');
    
    // Simulate creation process
    setTimeout(async () => {
        try {
            const userId = window.appState.currentUser.id;
            
            // Create flashcard set
            const { data: set, error: setError } = await window.supabase
                .from('flashcard_sets')
                .insert([{
                    user_id: userId,
                    name: setName,
                    subject: 'AI Generated',
                    description: `AI-generated flashcards from resource: ${resourceTitle}`
                }])
                .select()
                .single();

            if (setError) throw setError;

            // Create sample flashcards
            const sampleCards = [
                { question: "What are the key concepts in this resource?", answer: "Based on the analysis, this resource covers fundamental principles and practical applications." },
                { question: "How can this knowledge be applied?", answer: "These concepts can be used in real-world scenarios and academic projects." },
                { question: "What should I remember most?", answer: "Focus on understanding the core principles and their interconnections." }
            ];
            
            const flashcards = sampleCards.map((card, index) => ({
                set_id: set.id,
                question: card.question,
                answer: card.answer,
                order_index: index
            }));

            const { error: cardsError } = await window.supabase
                .from('flashcards')
                .insert(flashcards);

            if (cardsError) throw cardsError;

            window.utils.showNotification('Flashcard set created successfully!', 'success');
            
            // Refresh dashboard stats
            await loadDashboardData();
        } catch (error) {
            console.error('Error creating AI flashcards:', error);
            window.utils.showNotification('Failed to create flashcard set', 'error');
        }
    }, 1000);
}

async function saveAISummary(resourceId, resourceTitle, summary, studyPlan, flashcards) {
    try {
        const userId = window.appState.currentUser.id;
        
        await window.supabase
            .from('ai_summaries')
            .insert([{
                user_id: userId,
                file_name: resourceTitle,
                file_url: '', // Resource URL would be fetched from resources table
                summary: summary,
                study_plan: studyPlan,
                resource_id: resourceId // Link to the actual resource
            }]);
    } catch (error) {
        console.error('Error saving AI summary:', error);
    }
}

// Grades functions
async function loadGrades() {
    try {
        const userId = window.appState.currentUser.id;
        
        const { data: grades, error } = await window.supabase
            .from('grades')
            .select(`
                *,
                submissions!inner(
                    assignments!inner(title, max_points, classes!inner(name))
                )
            `)
            .eq('submissions.student_id', userId)
            .order('graded_at', { ascending: false });

        if (error) throw error;

        displayGrades(grades);
        calculateGPA(grades);
    } catch (error) {
        console.error('Error loading grades:', error);
        window.utils.showNotification('Failed to load grades', 'error');
    }
}

function displayGrades(grades) {
    const container = document.getElementById('gradesList');
    if (!container) return;
    
    if (grades.length === 0) {
        window.utils.showEmptyState(container, 'No grades yet', 'Complete and submit assignments to see your grades here');
        return;
    }

    container.innerHTML = grades.map(grade => {
        const assignment = grade.submissions.assignments;
        const percentage = ((grade.points / assignment.max_points) * 100).toFixed(1);
        
        return `
            <div class="grade-item">
                <div class="grade-info">
                    <h4>${assignment.title}</h4>
                    <p>${assignment.classes.name} • Graded ${window.utils.formatDate(grade.graded_at)}</p>
                </div>
                <div class="grade-score">
                    <span class="score">${grade.points}/${assignment.max_points}</span>
                    <span style="font-size: 0.75rem; color: var(--gray-600);">${percentage}%</span>
                    ${grade.feedback ? `<a href="#" class="feedback-btn" onclick="showFeedback('${grade.id}', \`${grade.feedback}\`)">View Feedback</a>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function calculateGPA(grades) {
    const gpaElement = document.getElementById('overallGPA');
    const countElement = document.getElementById('gradedCount');
    
    if (grades.length === 0) {
        if (gpaElement) gpaElement.textContent = '-';
        if (countElement) countElement.textContent = '0';
        return;
    }

    let totalPoints = 0;
    let totalMaxPoints = 0;

    grades.forEach(grade => {
        totalPoints += parseFloat(grade.points);
        totalMaxPoints += grade.submissions.assignments.max_points;
    });

    const gpa = ((totalPoints / totalMaxPoints) * 4.0).toFixed(2);
    
    if (gpaElement) gpaElement.textContent = gpa;
    if (countElement) countElement.textContent = grades.length;
}

function showFeedback(gradeId, feedback) {
    // Escape HTML in feedback for safety
    const escapedFeedback = feedback.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    window.utils.showNotification(`Feedback: ${escapedFeedback}`, 'info');
}

// Resource viewing functions
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

async function rateResource(resourceId) {
    // Simple rating function - could be expanded to a modal
    const rating = prompt('Rate this resource (1-5 stars):');
    if (rating && rating >= 1 && rating <= 5) {
        try {
            const userId = window.appState.currentUser.id;
            
            const { error } = await window.supabase
                .from('resource_ratings')
                .upsert({
                    resource_id: resourceId,
                    user_id: userId,
                    rating: parseInt(rating)
                });
            
            if (error) throw error;
            
            window.utils.showNotification('Rating saved successfully!', 'success');
            // Reload resources to show updated rating
            await loadResources();
        } catch (error) {
            console.error('Error rating resource:', error);
            window.utils.showNotification('Failed to save rating', 'error');
        }
    }
}

// Utility functions
function getResourceIcon(type) {
    const icons = {
        notes: '📝',
        code: '💻',
        video: '🎥',
        other: '📄'
    };
    return icons[type] || '📄';
}

function initializeEventListeners() {
    // File upload drag and drop for AI assistant
    const uploadZone = document.getElementById('aiUploadZone');
    
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        
                    uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const fileInput = document.getElementById('aiFileInput');
                if (fileInput) {
                    fileInput.files = files;
                    handleAIFileUpload({ target: { files: files } });
                }
            }
        });
    }

    // Initialize timer settings event listeners
    initializeTimerSettings();

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        const modals = ['uploadModal', 'createFlashcardModal', 'joinClassModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Helper functions for better error handling
function validateFormInputs(requiredFields) {
    for (const field of requiredFields) {
        const element = document.getElementById(field.id);
        if (!element) {
            console.error(`Required form element not found: ${field.id}`);
            return { valid: false, message: 'Form configuration error' };
        }
        
        const value = element.value ? element.value.trim() : '';
        if (field.required && !value) {
            return { valid: false, message: field.message, element: element };
        }
    }
    return { valid: true };
}

// Enhanced resource upload with better error handling
async function handleResourceUploadEnhanced(event) {
    event.preventDefault();
    
    // Validate all required form fields exist
    const validation = validateFormInputs([
        { id: 'resourceTitle', required: true, message: 'Please enter a title' },
        { id: 'resourceType', required: true, message: 'Please select a resource type' },
        { id: 'resourceFile', required: false, message: '' }
    ]);

    if (!validation.valid) {
        window.utils.showNotification(validation.message, 'error');
        if (validation.element) validation.element.focus();
        return;
    }

    const fileInput = document.getElementById('resourceFile');
    if (!fileInput.files[0]) {
        window.utils.showNotification('Please select a file', 'error');
        fileInput.focus();
        return;
    }

    // Call the main upload function
    await handleResourceUpload(event);
}

// Enhanced flashcard creation with better validation
async function handleCreateFlashcardSetEnhanced(event) {
    event.preventDefault();
    
    // Validate form fields
    const validation = validateFormInputs([
        { id: 'flashcardSetName', required: true, message: 'Please enter a flashcard set name' }
    ]);

    if (!validation.valid) {
        window.utils.showNotification(validation.message, 'error');
        if (validation.element) validation.element.focus();
        return;
    }

    // Validate flashcard inputs
    const questions = document.querySelectorAll('.flashcard-question');
    const answers = document.querySelectorAll('.flashcard-answer');
    
    let validCards = 0;
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i].value.trim();
        const answer = answers[i].value.trim();
        
        if (question && answer) {
            validCards++;
        } else if (question || answer) {
            window.utils.showNotification(`Card ${i + 1} is incomplete. Please fill both question and answer.`, 'error');
            return;
        }
    }

    if (validCards === 0) {
        window.utils.showNotification('Please add at least one complete flashcard', 'error');
        return;
    }

    // Call the main creation function
    await handleCreateFlashcardSet(event);
}

// Database connection test
async function testDatabaseConnection() {
    try {
        const { data, error } = await window.supabase
            .from('profiles')
            .select('id')
            .limit(1);
        
        if (error) {
            console.error('Database connection test failed:', error);
            window.utils.showNotification('Database connection failed', 'error');
            return false;
        }
        
        console.log('Database connection successful');
        return true;
    } catch (error) {
        console.error('Database connection error:', error);
        return false;
    }
}

// Storage bucket test
async function testStorageBucket() {
    try {
        const { data, error } = await window.supabase.storage
            .from('resources')
            .list('', { limit: 1 });
        
        if (error) {
            console.error('Storage bucket test failed:', error);
            window.utils.showNotification('Storage access failed', 'error');
            return false;
        }
        
        console.log('Storage bucket accessible');
        return true;
    } catch (error) {
        console.error('Storage bucket error:', error);
        return false;
    }
}

// Enhanced initialization with connectivity checks
async function initializeWithChecks() {
    try {
        // Test database and storage connectivity
        const dbConnected = await testDatabaseConnection();
        const storageConnected = await testStorageBucket();
        
        if (!dbConnected || !storageConnected) {
            window.utils.showNotification('Some features may not work properly due to connectivity issues', 'warning');
        }
        
        // Continue with normal initialization
        await checkAuth();
        await loadUserInfo();
        await loadDashboardData();
        initializeEventListeners();
        initializeTimer();
        
        console.log('Dashboard initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        window.utils.showNotification('Failed to initialize dashboard', 'error');
    }
}

// Utility functions
function getResourceIcon(type) {
    const icons = {
        notes: '📝',
        code: '💻',
        video: '🎥',
        other: '📄'
    };
    return icons[type] || '📄';
}

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    window.utils.showNotification('An unexpected error occurred', 'error');
});

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeWithChecks);
// Class page script
(function(){
  let classId = null;
  let user = null;
  let userType = 'student';

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Parse class_id
      const params = new URLSearchParams(window.location.search);
      classId = params.get('class_id');
      if (!classId) {
        window.utils.showNotification('Missing class_id', 'error');
        window.location.href = 'dashboard-student.html';
        return;
      }

      // Auth
      const authRes = await window.supabase.auth.getUser();
      user = authRes.data.user;
      if (!user) {
        window.location.href = 'index.html';
        return;
      }

      // Load profile
      const { data: profile } = await window.supabase
        .from('profiles')
        .select('full_name, user_type')
        .eq('id', user.id)
        .single();

      userType = profile?.user_type || 'student';
      const userInfoDiv = document.getElementById('userInfo');
      if (userInfoDiv) {
        userInfoDiv.innerHTML = `<h4>${profile?.full_name || user.email}</h4><p>${userType.charAt(0).toUpperCase()+userType.slice(1)}</p>`;
      }
      const roleBadge = document.getElementById('roleBadge');
      if (roleBadge) { roleBadge.style.display = 'inline-block'; roleBadge.textContent = userType.toUpperCase(); }

      await loadClassOverview();
      // Set back link based on role
      const backLink = document.getElementById('backToDashboardLink');
      if (backLink) backLink.href = (userType === 'teacher') ? 'dashboard-teacher.html' : 'dashboard-student.html';
      await setTab('overview');
    } catch (e) {
      console.error(e);
      window.utils.showNotification('Failed to load class', 'error');
    }
  });

  async function loadClassOverview(){
    const { data: cls, error } = await window.supabase
      .from('classes')
      .select('*, profiles!classes_teacher_id_fkey(full_name)')
      .eq('id', classId)
      .single();
    if (error) throw error;

    document.getElementById('className').textContent = cls.name;
    document.getElementById('classMeta').textContent = `${cls.subject || 'General'} • Teacher: ${cls.profiles?.full_name || 'Unknown'} • Code: ${cls.class_code}`;

    const { data: enrollment } = await window.supabase
      .from('class_enrollments')
      .select('id')
      .eq('class_id', classId)
      .eq('student_id', user.id)
      .maybeSingle();

    const overview = document.getElementById('overviewContent');
    overview.innerHTML = `
      <h3>About this class</h3>
      <p>${cls.description || 'No description provided.'}</p>
      <div class="stats-grid" style="margin-top:12px;">
        <div class="stat-card"><h3>Subject</h3><div class="stat-value">${cls.subject || '—'}</div></div>
        <div class="stat-card"><h3>Code</h3><div class="stat-value">${cls.class_code}</div></div>
        <div class="stat-card"><h3>Status</h3><div class="stat-value">${cls.is_active ? 'Active' : 'Archived'}</div></div>
      </div>
    `;

    // Show upload for teachers or enrolled students
    const uploadBox = document.getElementById('resourceUpload');
    if (uploadBox) {
      uploadBox.style.display = (userType === 'teacher' || !!enrollment) ? 'block' : 'none';
    }
  }

  async function loadResources(){
    const grid = document.getElementById('classResources');
    window.utils.showLoading(grid, 'Loading resources...');
    const { data: classRes, error } = await window.supabase
      .from('class_resources')
      .select('*, resources!inner(*)')
      .eq('class_id', classId)
      .order('id', { ascending: false });
    if (error) { grid.innerHTML = ''; window.utils.showNotification('Failed to load resources', 'error'); return; }
    if (!classRes || classRes.length === 0) { window.utils.showEmptyState(grid, 'No resources yet', 'Be the first to upload a resource.'); return; }

    const resources = classRes.map(cr => cr.resources);
    grid.innerHTML = resources.map(r => `
      <div class="resource-card">
        <div class="resource-header">
          <h3>${r.title}</h3>
          <div class="resource-meta">
            <span class="resource-type">${r.resource_type}</span>
            ${r.is_official ? '<span class="featured-badge">Official</span>' : ''}
          </div>
        </div>
        <div class="resource-body">
          <div class="resource-description">${r.description || ''}</div>
          <div class="resource-actions">
            <button class="btn-secondary btn-small" onclick="openResource('${r.id}')">Open</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  async function loadAssignments(){
    const container = document.getElementById('classAssignments');
    window.utils.showLoading(container, 'Loading assignments...');
    const { data: assignments, error } = await window.supabase
      .from('assignments')
      .select('*, submissions!left(id, student_id, grades(points))')
      .eq('class_id', classId)
      .eq('submissions.student_id', user.id)
      .order('due_date', { ascending: false });
    if (error) { container.innerHTML = ''; window.utils.showNotification('Failed to load assignments', 'error'); return; }
    if (!assignments || assignments.length === 0) { window.utils.showEmptyState(container, 'No assignments', ''); return; }

    container.innerHTML = assignments.map(a => {
      const mySub = (a.submissions || []).find(s => s.student_id === user.id);
      const graded = mySub && mySub.grades && mySub.grades.length > 0;
      return `
        <div class="assignment-card">
          <div class="assignment-header">
            <div>
              <h3 class="assignment-title">${a.title}</h3>
              <div class="assignment-meta">Due: ${window.utils.formatDateTime(a.due_date)} • Points: ${a.max_points || 100}</div>
            </div>
            <div class="assignment-status ${graded ? 'status-graded' : mySub ? 'status-submitted' : 'status-pending'}">
              ${graded ? 'Graded' : mySub ? 'Submitted' : 'Pending'}
            </div>
          </div>
          <div class="assignment-description">${a.description || ''}</div>
        </div>
      `;
    }).join('');
  }

  async function loadStudents(){
    const container = document.getElementById('classStudents');
    window.utils.showLoading(container, 'Loading students...');
    const { data: enrolls, error } = await window.supabase
      .from('class_enrollments')
      .select('profiles(full_name, email)')
      .eq('class_id', classId)
      .eq('is_active', true);
    if (error) { container.innerHTML = ''; window.utils.showNotification('Failed to load students', 'error'); return; }
    if (!enrolls || enrolls.length === 0) { window.utils.showEmptyState(container, 'No students', ''); return; }

    container.innerHTML = `
      <table class="table"><thead><tr><th>Name</th>${userType==='teacher' ? '<th>Email</th>' : ''}</tr></thead>
      <tbody>
        ${enrolls.map(e => `<tr><td>${e.profiles?.full_name || 'Unknown'}</td>${userType==='teacher' ? `<td>${e.profiles?.email || '-'}</td>` : ''}</tr>`).join('')}
      </tbody></table>
    `;
  }

  async function uploadClassResource(ev){
    ev.preventDefault();
    const title = document.getElementById('resTitle').value.trim();
    const desc = document.getElementById('resDesc').value.trim();
    const type = document.getElementById('resType').value;
    const file = document.getElementById('resFile').files[0];
    if (!title || !type || !file) { window.utils.showNotification('Fill all required fields','error'); return; }

    try {
      const ext = file.name.split('.').pop();
      const filename = `class/${classId}/${Date.now()}.${ext}`;
      const up = await window.supabase.storage.from('resources').upload(filename, file);
      if (up.error) throw up.error;
      const pub = window.supabase.storage.from('resources').getPublicUrl(filename);
      const { data: res, error: resErr } = await window.supabase
        .from('resources')
        .insert([{
          user_id: user.id,
          class_id: classId,
          title,
          description: desc,
          resource_type: type,
          file_url: pub.data.publicUrl,
          file_name: file.name,
          file_size: file.size,
          is_official: userType === 'teacher'
        }])
        .select('id')
        .single();
      if (resErr) throw resErr;
      window.utils.showNotification('Resource uploaded','success');
      await loadResources();
      document.getElementById('resTitle').value='';
      document.getElementById('resDesc').value='';
      document.getElementById('resFile').value='';
    } catch (e) {
      console.error(e);
      window.utils.showNotification(`Upload failed: ${e.message}`,'error');
    }
  }

  function setTab(tab){
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    const tabBtn = document.getElementById(`tab-${tab}`); if (tabBtn) tabBtn.classList.add('active');
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    const sec = document.getElementById(`section-${tab}`); if (sec) sec.classList.add('active');
    if (tab==='resources') loadResources();
    if (tab==='assignments') loadAssignments();
    if (tab==='students') loadStudents();
    return false;
  }

  async function openResource(id){
    const { data, error } = await window.supabase.from('resources').select('file_url, file_name').eq('id', id).single();
    if (error || !data?.file_url) { window.utils.showNotification('Resource not available','error'); return; }
    const url = data.file_url;
    const name = (data.file_name || '').toLowerCase();
    const ext = name.split('.').pop();
    const modal = document.getElementById('resourcePreviewModal');
    const iframe = document.getElementById('resourcePreviewFrame');
    let viewUrl = url;
    if (['doc','docx','ppt','pptx','xls','xlsx'].includes(ext)) {
      viewUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }
    if (modal && iframe) {
      iframe.src = viewUrl;
      modal.style.display = 'block';
    } else {
      window.open(viewUrl, '_blank');
    }
  }

  // Expose
  window.setTab = setTab;
  window.uploadClassResource = uploadClassResource;
  window.openResource = openResource;
})();

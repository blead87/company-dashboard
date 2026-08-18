// Company Dashboard - Todo Management System
// Data stored in todos.json, synced via GitHub

const COMPANIES = {
    'oorban':    { name: 'Oorban',    color: '#4a6fa5', fullName: 'Oorban (ROMULENS/PARKEADO)' },
    'mfc':       { name: 'MFC',       color: '#6b8e23', fullName: 'MFC Arquitectos' },
    'legnofino': { name: 'Legnofino', color: '#d2691e', fullName: 'Legnofino' },
    'penalma':   { name: 'Penalma',   color: '#8b4513', fullName: 'Penalma Capital' },
    'personal':  { name: 'Personal',  color: '#6a5acd', fullName: 'Personal' }
};

const PRIORITIES = {
    'high':   { name: 'Alta',  class: 'high' },
    'medium': { name: 'Media', class: 'medium' },
    'low':    { name: 'Baja',  class: 'low' }
};

let todos = [];
let lastSyncTime = new Date();
let syncInProgress = false;
let githubToken = null;
let hasUnsavedChanges = false; // true when local edits exist that haven't been pushed yet
let searchQuery = '';
let activeProjectFilter = null; // project name to filter by, or null
let showArchive = false;

const REPO_OWNER = 'blead87';
const REPO_NAME = 'company-dashboard';
const TODOS_FILE_PATH = 'todos.json';

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadTodos();
    setupEventListeners();
    updateLastSync();
    loadGitHubTokenToUI();
    populateCompanySelects();
    renderTodayLabel();

    // Auto-refresh every 60 seconds (pulls fresh data only when no unsaved edits)
    setInterval(loadTodos, 60 * 1000);

    // Auto-sync every 2 minutes if token is set
    setInterval(() => {
        if (getGitHubToken()) syncWithGitHub();
    }, 2 * 60 * 1000);
});

// ============================================================
// LOAD / SAVE
// ============================================================

async function loadTodos() {
    // CRITICAL: never clobber unsaved local edits with a stale remote copy.
    if (hasUnsavedChanges) {
        render();
        return;
    }

    try {
        let loaded = null;
        const token = getGitHubToken();

        // Authoritative source: GitHub API (always fresh)
        if (token) {
            try {
                const resp = await fetch(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TODOS_FILE_PATH}`,
                    { headers: { 'Authorization': `token ${sanitizeToken(token)}`, 'Accept': 'application/vnd.github.v3+json' } }
                );
                if (resp.ok) {
                    const data = await resp.json();
                    loaded = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    console.log('Loaded todos from GitHub API:', loaded.length);
                }
            } catch (e) {
                console.log('API load failed, falling back:', e.message);
            }
        }

        // Fallback: GitHub Pages static file (works without token)
        if (loaded === null) {
            const response = await fetch('https://blead87.github.io/company-dashboard/todos.json?' + Date.now());
            if (response.ok) {
                loaded = await response.json();
                console.log('Loaded todos from GitHub Pages:', loaded.length);
            }
        }

        if (loaded !== null) {
            todos = loaded;
            localStorage.setItem('company-dashboard-todos', JSON.stringify(todos));
        } else {
            const saved = localStorage.getItem('company-dashboard-todos');
            if (saved) todos = JSON.parse(saved);
        }
    } catch (error) {
        console.log('Using local storage fallback:', error.message);
        const saved = localStorage.getItem('company-dashboard-todos');
        if (saved) todos = JSON.parse(saved);
    }

    lastSyncTime = new Date();
    updateLastSync();
    render();
}

function saveTodos() {
    localStorage.setItem('company-dashboard-todos', JSON.stringify(todos));
    hasUnsavedChanges = true;
    lastSyncTime = new Date();
    updateLastSync();

    if (getGitHubToken()) {
        clearTimeout(window.saveTimeout);
        window.saveTimeout = setTimeout(() => pushToGitHub(), 500);
    }
}

// ============================================================
// RENDER
// ============================================================

function render() {
    renderFocusList();
    renderArchive();
    renderProjects();
    updateStats();
    updateSyncBadge();
}

function matchesSearch(t) {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const hay = [
        t.description, t.notes, t.project,
        t.company, COMPANIES[t.company] ? COMPANIES[t.company].name : ''
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
}

function isOverdue(t) {
    if (!t.dueDate || t.status === 'done') return false;
    const parts = t.dueDate.split('-');
    const dueDate = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    const date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return date.toLocaleDateString('es-DO', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
}

function renderFocusList() {
    const container = document.getElementById('focus-list');
    if (!container) return;

    const pending = todos.filter(t => t.status !== 'done' && matchesSearch(t) && matchesProject(t));

    // Group by company, in COMPANIES order
    const groups = [];
    Object.keys(COMPANIES).forEach(company => {
        const items = pending.filter(t => t.company === company);
        if (items.length > 0) groups.push({ company, items });
    });

    if (groups.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-check2-circle"></i>
                <p style="font-weight:600;color:var(--text);">Todo al día</p>
                <p style="font-size:13px;">No hay tareas pendientes${activeProjectFilter ? ' en este proyecto' : ''}.</p>
            </div>`;
        return;
    }

    container.innerHTML = groups.map(g => `
        <div class="group-lbl">
            <span class="bar" style="background:${COMPANIES[g.company].color}"></span>
            ${COMPANIES[g.company].name}
            <span class="gcount">${g.items.length}</span>
        </div>
        ${g.items.map(renderTask).join('')}
    `).join('');

    // Wire up event handlers for rendered tasks
    pending.forEach(t => wireTaskEvents(t.id));
}

function matchesProject(t) {
    if (!activeProjectFilter) return true;
    return (t.project || '') === activeProjectFilter;
}

function renderTask(t) {
    const company = COMPANIES[t.company] || { name: t.company, color: '#888' };
    const overdue = isOverdue(t);
    const done = t.status === 'done';

    const meta = [];
    meta.push(`<span class="company-tag" style="background:${company.color}">${company.name}</span>`);
    meta.push(`<span class="badge ${PRIORITIES[t.priority] ? PRIORITIES[t.priority].class : 'medium'}">${PRIORITIES[t.priority] ? PRIORITIES[t.priority].name : 'Media'}</span>`);
    if (t.project) meta.push(`<span class="badge proj"><i class="bi bi-folder me-1"></i>${escapeHtml(t.project)}</span>`);
    if (t.dueDate) {
        meta.push(`<span class="badge ${overdue ? 'overdue' : 'date'}"><i class="bi bi-calendar me-1"></i>${formatDate(t.dueDate)}${overdue ? ' · Vencida' : ''}</span>`);
    } else if (!done) {
        meta.push(`<span class="badge nodate">Sin fecha</span>`);
    }
    if (t.notes) meta.push(`<span class="badge date"><i class="bi bi-chat-left-text me-1"></i>${escapeHtml(t.notes.length > 60 ? t.notes.slice(0, 60) + '…' : t.notes)}</span>`);

    return `
        <div class="task ${done ? 'done-item' : ''}" data-id="${t.id}">
            <button class="ck ${done ? 'done' : ''}" data-action="toggle" title="Marcar completada"><i class="bi bi-check-lg"></i></button>
            <div class="body">
                <div class="t">${escapeHtml(t.description)}</div>
                <div class="meta">${meta.join('')}</div>
            </div>
            <div class="actions">
                <button data-action="edit" title="Editar"><i class="bi bi-pencil"></i></button>
                <button data-action="delete" class="del" title="Eliminar"><i class="bi bi-trash"></i></button>
            </div>
        </div>`;
}

function renderArchive() {
    const listEl = document.getElementById('archive-list');
    const countEl = document.getElementById('archive-count');
    const fillEl = document.getElementById('archive-fill');
    if (!listEl) return;

    const completed = todos.filter(t => t.status === 'done');
    const shown = completed.filter(t => matchesSearch(t) && matchesProject(t));

    countEl.textContent = `${completed.length} tareas`;
    if (fillEl) {
        const pct = todos.length > 0 ? Math.round((completed.length / todos.length) * 100) : 0;
        fillEl.style.width = pct + '%';
    }

    if (shown.length === 0) {
        listEl.innerHTML = `<div class="empty-state" style="padding:16px;"><p style="font-size:13px;">Sin tareas completadas.</p></div>`;
    } else {
        listEl.innerHTML = shown.map(renderTask).join('');
        shown.forEach(t => wireTaskEvents(t.id));
    }
}

function renderProjects() {
    const container = document.getElementById('projects-list');
    const countEl = document.getElementById('proj-count');
    if (!container) return;

    // Aggregate tasks by project
    const projMap = {};
    todos.forEach(t => {
        if (!t.project) return;
        if (!projMap[t.project]) projMap[t.project] = { project: t.project, company: t.company, total: 0, pending: 0 };
        projMap[t.project].total++;
        if (t.status !== 'done') projMap[t.project].pending++;
    });

    const projects = Object.values(projMap).sort((a, b) => b.total - a.total);
    countEl.textContent = String(projects.length);

    if (projects.length === 0) {
        container.innerHTML = `<div class="side-note">Sin proyectos todavía. Usa el campo "Proyecto" al añadir tareas para agruparlas.</div>`;
        return;
    }

    container.innerHTML = projects.map(p => `
        <button class="proj-row ${activeProjectFilter === p.project ? 'active' : ''}" data-project="${escapeHtml(p.project)}">
            <span class="sw" style="background:${COMPANIES[p.company] ? COMPANIES[p.company].color : '#888'}"></span>
            <span class="n">${escapeHtml(p.project)}</span>
            ${p.pending > 0 ? `<span class="c pend">${p.pending} pend.</span>` : ''}
            <span class="c">${p.total}</span>
        </button>
    `).join('');

    container.querySelectorAll('.proj-row').forEach(btn => {
        btn.addEventListener('click', () => {
            const proj = btn.getAttribute('data-project');
            activeProjectFilter = (activeProjectFilter === proj) ? null : proj;
            render();
        });
    });

    renderFilterChip();
}

function renderFilterChip() {
    const area = document.getElementById('filter-area');
    if (!area) return;
    if (activeProjectFilter) {
        area.innerHTML = `<div class="filter-chip" id="clear-filter"><i class="bi bi-funnel-fill"></i> ${escapeHtml(activeProjectFilter)} <span class="x">✕</span></div>`;
        const chip = document.getElementById('clear-filter');
        if (chip) chip.addEventListener('click', () => { activeProjectFilter = null; render(); });
    } else {
        area.innerHTML = '';
    }
}

function renderTodayLabel() {
    const el = document.getElementById('today-label');
    if (el) el.textContent = 'Hoy · ' + new Date().toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================================
// TASK ACTIONS
// ============================================================

function addTodo(description, company, priority, dueDate = null, notes = '', project = '') {
    if (!description.trim()) return null;
    const newTodo = {
        id: Date.now().toString(),
        description: description.trim(),
        company: company,
        priority: priority,
        dueDate: dueDate || null,
        notes: notes.trim(),
        project: project.trim(),
        status: 'pending',
        createdAt: new Date().toISOString().split('T')[0]
    };
    todos.push(newTodo);
    saveTodos();
    render();
    return newTodo;
}

function quickAdd() {
    const input = document.getElementById('quick-task');
    const company = document.getElementById('quick-company').value;
    const priority = document.getElementById('quick-priority').value;
    if (!input.value.trim()) return;
    addTodo(input.value, company, priority);
    input.value = '';
    input.focus();
    // Remember last company for next time
    localStorage.setItem('company-dashboard-last-company', company);
}

function toggleTodoStatus(todoId) {
    const todo = todos.find(t => t.id === todoId);
    if (todo) {
        todo.status = todo.status === 'done' ? 'pending' : 'done';
        saveTodos();
        render();
    }
}

function deleteTodo(todoId) {
    if (confirm('¿Eliminar esta tarea?')) {
        todos = todos.filter(t => t.id !== todoId);
        saveTodos();
        render();
    }
}

function wireTaskEvents(todoId) {
    const el = document.querySelector(`.task[data-id="${todoId}"]`);
    if (!el) return;
    el.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            if (action === 'toggle') toggleTodoStatus(todoId);
            else if (action === 'edit') openEditModal(todoId);
            else if (action === 'delete') deleteTodo(todoId);
        });
    });
}

// ============================================================
// EDIT MODAL
// ============================================================

function openEditModal(todoId) {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    document.getElementById('edit-task-id').value = todo.id;
    document.getElementById('edit-task-description').value = todo.description;
    document.getElementById('edit-task-company').value = todo.company;
    document.getElementById('edit-task-priority').value = todo.priority;
    document.getElementById('edit-task-project').value = todo.project || '';
    document.getElementById('edit-task-status').value = todo.status;
    document.getElementById('edit-task-due-date').value = todo.dueDate || '';
    document.getElementById('edit-task-notes').value = todo.notes || '';
    new bootstrap.Modal(document.getElementById('editTaskModal')).show();
}

function saveEditedTodo() {
    const todoId = document.getElementById('edit-task-id').value;
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    todo.description = document.getElementById('edit-task-description').value.trim();
    todo.company = document.getElementById('edit-task-company').value;
    todo.priority = document.getElementById('edit-task-priority').value;
    todo.project = document.getElementById('edit-task-project').value.trim();
    todo.status = document.getElementById('edit-task-status').value;
    todo.dueDate = document.getElementById('edit-task-due-date').value || null;
    todo.notes = document.getElementById('edit-task-notes').value.trim();
    saveTodos();
    render();
    bootstrap.Modal.getInstance(document.getElementById('editTaskModal')).hide();
}

function deleteFromEditModal() {
    const todoId = document.getElementById('edit-task-id').value;
    bootstrap.Modal.getInstance(document.getElementById('editTaskModal')).hide();
    deleteTodo(todoId);
}

// ============================================================
// STATS / STATUS
// ============================================================

function updateStats() {
    const total = todos.length;
    const pending = todos.filter(t => t.status !== 'done').length;
    const high = todos.filter(t => t.priority === 'high' && t.status !== 'done').length;
    const overdue = todos.filter(t => isOverdue(t) && t.status !== 'done').length;
    const completed = todos.filter(t => t.status === 'done').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stat-pending', String(pending));
    set('stat-high', String(high));
    set('stat-overdue', String(overdue));
    set('stat-complete', pct + '%');
    set('stat-complete-n', String(completed));
}

function updateSyncBadge() {
    const el = document.getElementById('sync-badge');
    if (!el) return;
    if (!getGitHubToken()) {
        el.className = 'sync-badge off';
        el.textContent = 'Sin token';
    } else if (hasUnsavedChanges) {
        el.className = 'sync-badge warn';
        el.textContent = '⏳ Sincronizando…';
    } else {
        el.className = 'sync-badge ok';
        el.textContent = '✓ Sincronizado';
    }
}

function updateLastSync() {
    // Keep for compatibility; sync badge now shows state instead of time.
}

// ============================================================
// GITHUB TOKEN
// ============================================================

function getGitHubToken() {
    if (githubToken) return githubToken;
    const saved = localStorage.getItem('company-dashboard-github-token');
    if (saved) { githubToken = saved; return githubToken; }
    return null;
}

function sanitizeToken(token) {
    if (!token) return '';
    return token.replace(/[^\x00-\x7F]/g, '').trim();
}

function setGitHubToken(token) {
    githubToken = token;
    localStorage.setItem('company-dashboard-github-token', token);
}

function saveGitHubToken() {
    const input = document.getElementById('github-token');
    if (input && input.value.trim()) {
        const raw = input.value.trim();
        if (raw === '••••••••••••••••••••') {
            showSyncStatus('⚠️ El token ya está guardado. Pega uno nuevo para reemplazarlo.', 'warning');
            return;
        }
        const clean = sanitizeToken(raw);
        if (!clean) { showSyncStatus('⚠️ Token inválido', 'warning'); return; }
        setGitHubToken(clean);
        input.value = '';
        updateSyncBadge();
        showSyncStatus('✅ Token guardado', 'success');
        setTimeout(() => syncWithGitHub(), 800);
    } else {
        showSyncStatus('⚠️ Pega un token', 'warning');
    }
}

function loadGitHubTokenToUI() {
    const input = document.getElementById('github-token');
    if (input && getGitHubToken()) {
        input.value = '••••••••••••••••••••';
        input.placeholder = 'Token guardado';
    }
}

// ============================================================
// GITHUB SYNC
// ============================================================

async function getFileSha() {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TODOS_FILE_PATH}`,
            { headers: { 'Authorization': `token ${sanitizeToken(getGitHubToken())}`, 'Accept': 'application/vnd.github.v3+json' } }
        );
        if (response.ok) {
            const data = await response.json();
            return data.sha;
        } else if (response.status === 404) {
            return null;
        }
    } catch (error) {
        console.error('Error getting file SHA:', error);
    }
    return null;
}

async function pushToGitHub() {
    if (syncInProgress) return;
    if (!getGitHubToken()) return;
    syncInProgress = true;
    updateSyncBadge();

    try {
        let pushed = false;
        for (let attempt = 0; attempt < 2 && !pushed; attempt++) {
            const sha = await getFileSha();
            const jsonStr = JSON.stringify(todos, null, 2);
            const content = btoa(unescape(encodeURIComponent(jsonStr)));

            const response = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TODOS_FILE_PATH}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${sanitizeToken(getGitHubToken())}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: `Auto-sync: ${new Date().toLocaleString()}`, content, sha })
                }
            );

            if (response.ok) {
                pushed = true;
                hasUnsavedChanges = false;
                console.log('Successfully pushed to GitHub');
                updateSyncBadge();
                showSyncStatus('✅ Synced to GitHub', 'success');
            } else if (response.status === 409 && attempt === 0) {
                console.warn('409 conflict on push, retrying with fresh SHA…');
                continue;
            } else {
                let errMsg = '';
                try { const err = await response.json(); errMsg = err.message || ''; } catch (e) {}
                console.error('GitHub push failed:', response.status, errMsg);
                if (response.status === 401) {
                    showSyncStatus('❌ Token inválido o expirado. Genera uno nuevo en github.com/settings/tokens.', 'danger');
                } else if (response.status === 409) {
                    showSyncStatus('⚠️ Conflicto de versión. Haz "Pull" y luego "Push".', 'warning');
                } else {
                    showSyncStatus(`❌ Sync failed (${response.status}${errMsg ? ': ' + errMsg : ''})`, 'danger');
                }
            }
        }
    } catch (error) {
        console.error('Error pushing to GitHub:', error);
        showSyncStatus('❌ Sync error', 'danger');
    } finally {
        syncInProgress = false;
        updateSyncBadge();
    }
}

async function pullFromGitHub() {
    if (syncInProgress) return;
    if (!getGitHubToken()) return;
    syncInProgress = true;

    try {
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TODOS_FILE_PATH}`,
            { headers: { 'Authorization': `token ${sanitizeToken(getGitHubToken())}`, 'Accept': 'application/vnd.github.v3+json' } }
        );

        if (response.ok) {
            const data = await response.json();
            const content = decodeURIComponent(escape(atob(data.content)));
            const remoteTodos = JSON.parse(content);
            todos = remoteTodos;
            localStorage.setItem('company-dashboard-todos', JSON.stringify(todos));
            hasUnsavedChanges = false;
            console.log('Successfully pulled from GitHub');
            updateSyncBadge();
            render();
            showSyncStatus('✅ Synced from GitHub', 'success');
        } else {
            let errMsg = '';
            try { const err = await response.json(); errMsg = err.message || ''; } catch (e) {}
            console.error('GitHub pull failed:', response.status, errMsg);
            showSyncStatus(`❌ Sync failed (${response.status}${errMsg ? ': ' + errMsg : ''})`, 'danger');
        }
    } catch (error) {
        console.error('Error pulling from GitHub:', error);
        showSyncStatus('❌ Sync error', 'danger');
    } finally {
        syncInProgress = false;
        updateSyncBadge();
    }
}

async function syncWithGitHub() {
    if (!getGitHubToken()) {
        showSyncStatus('⚠️ Guarda un token para activar el sync', 'warning');
        return;
    }
    try {
        if (hasUnsavedChanges) {
            await pushToGitHub();
        } else {
            await pullFromGitHub();
        }
    } catch (error) {
        console.error('Sync error:', error);
        showSyncStatus(`❌ Sync error: ${error.message}`, 'danger');
    }
}

// ============================================================
// UI HELPERS
// ============================================================

function populateCompanySelects() {
    const opts = Object.keys(COMPANIES).map(k =>
        `<option value="${k}">${COMPANIES[k].name}</option>`
    ).join('');
    ['quick-company', 'edit-task-company'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
    const lastCompany = localStorage.getItem('company-dashboard-last-company');
    const quickSel = document.getElementById('quick-company');
    if (quickSel && lastCompany && COMPANIES[lastCompany]) quickSel.value = lastCompany;
}

function setupEventListeners() {
    // Quick add form
    const form = document.getElementById('quick-form');
    if (form) {
        form.addEventListener('submit', e => { e.preventDefault(); quickAdd(); });
    }

    // Search
    const search = document.getElementById('search-input');
    if (search) {
        search.addEventListener('input', () => { searchQuery = search.value; render(); });
    }

    // Ctrl/Cmd+K focuses search
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (search) search.focus();
        }
    });

    // Archive toggle
    const archiveToggle = document.getElementById('archive-toggle');
    if (archiveToggle) {
        archiveToggle.addEventListener('click', () => {
            showArchive = !showArchive;
            archiveToggle.classList.toggle('open', showArchive);
            document.getElementById('archive-body').classList.toggle('open', showArchive);
        });
    }

    // Edit modal
    document.getElementById('edit-task-save').addEventListener('click', saveEditedTodo);
    document.getElementById('edit-task-delete').addEventListener('click', deleteFromEditModal);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showSyncStatus(message, type = 'info') {
    let statusEl = document.getElementById('sync-status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'sync-status';
        statusEl.style.position = 'fixed';
        statusEl.style.top = '70px';
        statusEl.style.right = '20px';
        statusEl.style.zIndex = '1000';
        statusEl.style.maxWidth = '320px';
        document.body.appendChild(statusEl);
    }
    const colors = { success: 'var(--green)', danger: 'var(--red)', warning: 'var(--amber)', info: 'var(--accent-2)' };
    statusEl.style.background = 'var(--card)';
    statusEl.style.color = 'var(--text)';
    statusEl.style.border = '1px solid ' + (colors[type] || colors.info);
    statusEl.style.borderLeft = '4px solid ' + (colors[type] || colors.info);
    statusEl.style.borderRadius = '8px';
    statusEl.style.padding = '12px 16px';
    statusEl.style.fontSize = '14px';
    statusEl.style.boxShadow = '0 6px 20px rgba(0,0,0,.5)';
    statusEl.textContent = message;

    clearTimeout(window.statusTimeout);
    window.statusTimeout = setTimeout(() => {
        if (statusEl && statusEl.parentNode) statusEl.remove();
    }, 3500);
}

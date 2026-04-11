// Company Dashboard - Todo Management System
// Data stored in todos.json, synced via GitHub

const COMPANIES = {
    'oorban': { name: 'Oorban', color: '#4a6fa5', fullName: 'Oorban (ROMULENS/PARKEADO)' },
    'mfc': { name: 'MFC', color: '#6b8e23', fullName: 'MFC Arquitectos' },
    'legnofino': { name: 'Legnofino', color: '#d2691e', fullName: 'Legnofino' },
    'penalma': { name: 'Penalma', color: '#8b4513', fullName: 'Penalma Capital' },
    'personal': { name: 'Personal', color: '#6a5acd', fullName: 'Personal' }
};

const PRIORITIES = {
    'high': { name: 'High', class: 'priority-high', icon: 'bi-exclamation-triangle-fill text-danger' },
    'medium': { name: 'Medium', class: 'priority-medium', icon: 'bi-exclamation-circle-fill text-warning' },
    'low': { name: 'Low', class: 'priority-low', icon: 'bi-info-circle-fill text-success' }
};

let todos = [];
let lastSyncTime = new Date();
let hideCompleted = false;
let syncInProgress = false;
let githubToken = null;
const REPO_OWNER = 'blead87';
const REPO_NAME = 'company-dashboard';
const TODOS_FILE_PATH = 'todos.json';

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadTodos();
    setupEventListeners();
    updateLastSync();
    loadGitHubTokenToUI();
    initTheme();
    
    // Add theme toggle event listener
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Auto-refresh every 5 minutes
    setInterval(loadTodos, 5 * 60 * 1000);
    
    // Auto-sync on startup if token is set
    setTimeout(() => {
        if (getGitHubToken()) {
            syncWithGitHub();
        }
    }, 2000);
});

// Load todos from GitHub (or local storage as fallback)
async function loadTodos() {
    try {
        // Try to load from GitHub
        const response = await fetch('https://raw.githubusercontent.com/blead87/company-dashboard/main/todos.json');
        if (response.ok) {
            todos = await response.json();
            console.log('Loaded todos from GitHub:', todos.length);
        } else {
            // Fallback to local storage
            const saved = localStorage.getItem('company-dashboard-todos');
            if (saved) {
                todos = JSON.parse(saved);
                console.log('Loaded todos from local storage:', todos.length);
            }
        }
    } catch (error) {
        console.log('Using local storage fallback:', error.message);
        const saved = localStorage.getItem('company-dashboard-todos');
        if (saved) {
            todos = JSON.parse(saved);
        }
    }
    
    lastSyncTime = new Date();
    updateLastSync();
    renderTodos();
    updateStats();
}

// Save todos (to local storage, auto-push to GitHub if token set)
function saveTodos() {
    // Save to local storage
    localStorage.setItem('company-dashboard-todos', JSON.stringify(todos));
    
    // Update last sync time
    lastSyncTime = new Date();
    updateLastSync();
    
    // Auto-push to GitHub if token is set
    if (getGitHubToken()) {
        // Debounce: wait 1 second before pushing to avoid rapid API calls
        clearTimeout(window.saveTimeout);
        window.saveTimeout = setTimeout(() => {
            pushToGitHub();
        }, 1000);
    }
}

// Render todos for all tabs
function renderTodos() {
    // Render for each company tab
    Object.keys(COMPANIES).forEach(company => {
        const companyTodos = todos.filter(todo => todo.company === company);
        renderTodoList(`todo-list-${company}`, companyTodos);
    });
    
    // Render "All" tab
    renderTodoList('todo-list-all', todos);
}

// Render a todo list to a specific element
function renderTodoList(elementId, todoList) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    // Filter out completed tasks if hideCompleted is true
    let filteredTodos = todoList;
    if (hideCompleted) {
        filteredTodos = todoList.filter(todo => todo.status !== 'done');
    }
    
    if (filteredTodos.length === 0) {
        const message = hideCompleted && todoList.length > 0 
            ? 'No pending tasks. Uncheck "Hide Completed" to see all tasks.'
            : 'No tasks found. Add your first task!';
        
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-check2-circle display-6 mb-3"></i>
                <p>${message}</p>
            </div>
        `;
        return;
    }
    
    // Sort by: overdue first, then priority, then due date
    const sortedTodos = [...filteredTodos].sort((a, b) => {
        // Overdue tasks first
        const aOverdue = isOverdue(a);
        const bOverdue = isOverdue(b);
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        
        // Then by priority (high to low)
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        
        // Then by due date (earliest first)
        if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        
        return 0;
    });
    
    container.innerHTML = sortedTodos.map(todo => renderTodoItem(todo)).join('');
    
    // Add event listeners to the new elements
    sortedTodos.forEach(todo => {
        const checkbox = document.getElementById(`todo-checkbox-${todo.id}`);
        const deleteBtn = document.getElementById(`todo-delete-${todo.id}`);
        
        if (checkbox) {
            checkbox.addEventListener('change', () => toggleTodoStatus(todo.id));
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteTodo(todo.id));
        }
    });
}

// Render a single todo item
function renderTodoItem(todo) {
    const company = COMPANIES[todo.company];
    const priority = PRIORITIES[todo.priority];
    const overdue = isOverdue(todo);
    const statusClass = todo.status === 'done' ? 'status-done' : '';
    const overdueClass = overdue ? 'border-danger border-2' : '';
    
    const dueDateText = todo.dueDate ? 
        `<small class="text-muted"><i class="bi bi-calendar me-1"></i>${formatDate(todo.dueDate)}${overdue ? ' <span class="badge bg-danger">Overdue</span>' : ''}</small>` : 
        '';
    
    const notesText = todo.notes ? 
        `<small class="text-muted d-block mt-1"><i class="bi bi-chat-left-text me-1"></i>${todo.notes}</small>` : 
        '';
    
    const projectText = todo.project ? 
        `<span class="badge bg-info me-2"><i class="bi bi-folder me-1"></i>${todo.project}</span>` : 
        '';
    
    return `
        <div class="card mb-2 todo-item ${statusClass} ${overdueClass} company-${todo.company}">
            <div class="card-body py-2">
                <div class="d-flex align-items-start">
                    <div class="form-check me-2 mt-1">
                        <input class="form-check-input" type="checkbox" 
                               id="todo-checkbox-${todo.id}" 
                               ${todo.status === 'done' ? 'checked' : ''}>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="company-badge badge-${todo.company} me-2">
                                    ${company.name}
                                </span>
                                <span class="${priority.class} px-2 py-1 rounded me-2">
                                    <i class="${priority.icon} me-1"></i>${priority.name}
                                </span>
                                ${projectText}
                            </div>
                            <button class="btn btn-sm btn-outline-danger" id="todo-delete-${todo.id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                        <p class="mb-1 mt-2">${todo.description}</p>
                        ${dueDateText}
                        ${notesText}
                        <small class="text-muted d-block mt-1">
                            <i class="bi bi-clock me-1"></i>Created: ${formatDate(todo.createdAt)}
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Add new todo
function addTodo(description, company, priority, dueDate = null, notes = '', project = '') {
    const newTodo = {
        id: Date.now().toString(),
        description: description.trim(),
        company: company,
        priority: priority,
        dueDate: dueDate,
        notes: notes.trim(),
        project: project.trim(),
        status: 'pending',
        createdAt: new Date().toISOString().split('T')[0]
    };
    
    todos.push(newTodo);
    saveTodos();
    renderTodos();
    updateStats();
    
    // Reset form
    document.getElementById('add-todo-form').reset();
    
    return newTodo;
}

// Quick add task from header
function addQuickTask() {
    const input = document.getElementById('quick-task');
    const task = input.value.trim();
    
    if (task) {
        addTodo(task, 'oorban', 'medium');
        input.value = '';
        input.focus();
    }
}

// Toggle todo status (pending/done)
function toggleTodoStatus(todoId) {
    const todo = todos.find(t => t.id === todoId);
    if (todo) {
        todo.status = todo.status === 'done' ? 'pending' : 'done';
        saveTodos();
        renderTodos();
        updateStats();
    }
}

// Delete todo
function deleteTodo(todoId) {
    if (confirm('Are you sure you want to delete this task?')) {
        todos = todos.filter(t => t.id !== todoId);
        saveTodos();
        renderTodos();
        updateStats();
    }
}

// Update dashboard statistics
function updateStats() {
    const total = todos.length;
    const pending = todos.filter(t => t.status === 'pending').length;
    const highPriority = todos.filter(t => t.priority === 'high' && t.status === 'pending').length;
    const overdue = todos.filter(t => isOverdue(t) && t.status === 'pending').length;
    
    document.getElementById('total-todos').textContent = total;
    document.getElementById('pending-todos').textContent = pending;
    document.getElementById('high-priority').textContent = highPriority;
    document.getElementById('overdue-todos').textContent = overdue;
}

// Check if a todo is overdue
function isOverdue(todo) {
    if (!todo.dueDate || todo.status === 'done') return false;
    const dueDate = new Date(todo.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
}

// Update last sync time display
function updateLastSync() {
    const element = document.getElementById('last-sync');
    if (element) {
        const now = new Date();
        const diffMs = now - lastSyncTime;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) {
            element.textContent = 'Just now';
        } else if (diffMins === 1) {
            element.textContent = '1 minute ago';
        } else if (diffMins < 60) {
            element.textContent = `${diffMins} minutes ago`;
        } else {
            element.textContent = lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }
}

// GitHub Token Functions

// Save GitHub token from input
function saveGitHubToken() {
    const tokenInput = document.getElementById('github-token');
    if (tokenInput && tokenInput.value.trim()) {
        setGitHubToken(tokenInput.value.trim());
        tokenInput.value = ''; // Clear for security
        showSyncStatus('✅ GitHub token saved', 'success');
        
        // Auto-sync after saving token
        setTimeout(() => syncWithGitHub(), 1000);
    } else {
        showSyncStatus('⚠️ Please enter a token', 'warning');
    }
}

// Load saved token into input (masked)
function loadGitHubTokenToUI() {
    const token = getGitHubToken();
    const tokenInput = document.getElementById('github-token');
    if (tokenInput && token) {
        tokenInput.value = '••••••••••••••••••••'; // Masked display
        tokenInput.placeholder = 'Token saved (click Sync Now)'; 
    }
}

// Toggle hide completed filter
function toggleHideCompleted() {
    hideCompleted = !hideCompleted;
    
    // Update toggle switch
    const toggle = document.getElementById('hide-completed-toggle');
    if (toggle) {
        toggle.checked = hideCompleted;
    }
    
    // Save preference to local storage
    localStorage.setItem('company-dashboard-hide-completed', hideCompleted.toString());
    
    // Re-render todos
    renderTodos();
}

// Setup event listeners
function setupEventListeners() {
    // Add todo form
    const form = document.getElementById('add-todo-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const description = document.getElementById('task-description').value;
            const company = document.getElementById('task-company').value;
            const priority = document.getElementById('task-priority').value;
            const dueDate = document.getElementById('task-due-date').value || null;
            const notes = document.getElementById('task-notes').value;
            const project = document.getElementById('task-project').value;
            
            addTodo(description, company, priority, dueDate, notes, project);
            
            // Show success message
            const button = form.querySelector('button[type="submit"]');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="bi bi-check2 me-2"></i>Added!';
            button.classList.remove('btn-primary');
            button.classList.add('btn-success');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('btn-success');
                button.classList.add('btn-primary');
            }, 2000);
        });
    }
    
    // Quick add on Enter key
    const quickTaskInput = document.getElementById('quick-task');
    if (quickTaskInput) {
        quickTaskInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addQuickTask();
            }
        });
    }
    
    // Hide completed toggle
    const hideCompletedToggle = document.getElementById('hide-completed-toggle');
    if (hideCompletedToggle) {
        // Load saved preference
        const savedPreference = localStorage.getItem('company-dashboard-hide-completed');
        if (savedPreference !== null) {
            hideCompleted = savedPreference === 'true';
            hideCompletedToggle.checked = hideCompleted;
        }
        
        hideCompletedToggle.addEventListener('change', toggleHideCompleted);
    }
    
    // Load sample data button (for testing)
    const loadSampleBtn = document.createElement('button');
    loadSampleBtn.className = 'btn btn-sm btn-outline-secondary d-none';
    loadSampleBtn.innerHTML = '<i class="bi bi-download me-1"></i>Load Sample Data';
    loadSampleBtn.onclick = loadSampleData;
    
    const footer = document.querySelector('.text-center');
    if (footer) {
        footer.appendChild(document.createElement('br'));
        footer.appendChild(loadSampleBtn);
    }
}

// Load sample data for testing
function loadSampleData() {
    const sampleTodos = [
        {
            id: '1',
            description: 'Check LinkedIn Post 4 performance',
            company: 'oorban',
            priority: 'high',
            dueDate: new Date().toISOString().split('T')[0],
            notes: 'Narrative format only, no CTA',
            status: 'pending',
            createdAt: '2026-04-08'
        },
        {
            id: '2',
            description: 'MFC Project Stall Scan',
            company: 'mfc',
            priority: 'medium',
            dueDate: '2026-04-09',
            notes: 'Melia Punta Bergantín, Palma Real, Naves Comerciales Escar',
            status: 'pending',
            createdAt: '2026-04-08'
        },
        {
            id: '3',
            description: 'Legnofino Platform Decision',
            company: 'legnofino',
            priority: 'high',
            dueDate: '2026-04-09',
            notes: 'YES/NO on 4-6 week build',
            status: 'pending',
            createdAt: '2026-04-08'
        },
        {
            id: '4',
            description: 'Define Penalma Q2 2026 Targets',
            company: 'penalma',
            priority: 'medium',
            dueDate: '2026-04-10',
            notes: 'ETF contributions, liquidity buffer, deal pipeline',
            status: 'pending',
            createdAt: '2026-04-08'
        },
        {
            id: '5',
            description: 'Therapist Appointment',
            company: 'personal',
            priority: 'medium',
            dueDate: '2026-04-09',
            notes: '3pm AST',
            status: 'pending',
            createdAt: '2026-04-08'
        }
    ];
    
    todos = sampleTodos;
    saveTodos();
    renderTodos();
    updateStats();
    alert('Sample data loaded!');
}

// GitHub API Sync Functions

// Get GitHub token from user or local storage
function getGitHubToken() {
    if (githubToken) return githubToken;
    
    // Check local storage
    const savedToken = localStorage.getItem('company-dashboard-github-token');
    if (savedToken) {
        githubToken = savedToken;
        return githubToken;
    }
    
    return null;
}

// Set GitHub token
function setGitHubToken(token) {
    githubToken = token;
    localStorage.setItem('company-dashboard-github-token', token);
    console.log('GitHub token saved');
}

// Get file SHA (needed for updates)
async function getFileSha() {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TODOS_FILE_PATH}`,
            {
                headers: {
                    'Authorization': `token ${getGitHubToken()}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            return data.sha;
        } else if (response.status === 404) {
            // File doesn't exist yet
            return null;
        }
    } catch (error) {
        console.error('Error getting file SHA:', error);
    }
    return null;
}

// Push todos to GitHub
async function pushToGitHub() {
    if (syncInProgress) return;
    if (!getGitHubToken()) return;
    
    syncInProgress = true;
    
    try {
        const sha = await getFileSha();
        const content = btoa(JSON.stringify(todos, null, 2));
        
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TODOS_FILE_PATH}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${getGitHubToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Auto-sync: ${new Date().toLocaleString()}`,
                    content: content,
                    sha: sha
                })
            }
        );
        
        if (response.ok) {
            console.log('Successfully pushed to GitHub');
            lastSyncTime = new Date();
            updateLastSync();
            showSyncStatus('✅ Synced to GitHub', 'success');
        } else {
            const error = await response.json();
            console.error('GitHub push failed:', error);
            showSyncStatus('❌ Sync failed', 'danger');
        }
    } catch (error) {
        console.error('Error pushing to GitHub:', error);
        showSyncStatus('❌ Sync error', 'danger');
    } finally {
        syncInProgress = false;
    }
}

// Pull todos from GitHub
async function pullFromGitHub() {
    if (syncInProgress) return;
    if (!getGitHubToken()) return;
    
    syncInProgress = true;
    
    try {
        // Use GitHub API to get file content (supports auth)
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TODOS_FILE_PATH}`,
            {
                headers: {
                    'Authorization': `token ${getGitHubToken()}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            // GitHub API returns base64 encoded content
            const content = atob(data.content);
            const remoteTodos = JSON.parse(content);
            
            // Simple conflict resolution: remote wins if newer
            // In a real app, you'd want more sophisticated merging
            todos = remoteTodos;
            saveTodos(); // Save to local storage
            
            console.log('Successfully pulled from GitHub');
            lastSyncTime = new Date();
            updateLastSync();
            renderTodos();
            updateStats();
            showSyncStatus('✅ Synced from GitHub', 'success');
        } else {
            const error = await response.json();
            console.error('GitHub pull failed:', error);
            showSyncStatus(`❌ Sync failed: ${error.message || response.status}`, 'danger');
        }
    } catch (error) {
        console.error('Error pulling from GitHub:', error);
        showSyncStatus('❌ Sync error', 'danger');
    } finally {
        syncInProgress = false;
    }
}

// Two-way sync
async function syncWithGitHub() {
    if (!getGitHubToken()) {
        showSyncStatus('⚠️ Set GitHub token to enable sync', 'warning');
        return;
    }
    
    try {
        // First pull, then push (simple strategy)
        await pullFromGitHub();
        await pushToGitHub();
        showSyncStatus('✅ Synced successfully!', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        showSyncStatus(`❌ Sync error: ${error.message}`, 'danger');
    }
}

// Show sync status message
function showSyncStatus(message, type = 'info') {
    // Create or update status element
    let statusEl = document.getElementById('sync-status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'sync-status';
        statusEl.className = 'alert alert-dismissible fade show';
        statusEl.style.position = 'fixed';
        statusEl.style.top = '70px';
        statusEl.style.right = '20px';
        statusEl.style.zIndex = '1000';
        statusEl.style.maxWidth = '300px';
        
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.setAttribute('data-bs-dismiss', 'alert');
        statusEl.appendChild(closeBtn);
        
        document.body.appendChild(statusEl);
    }
    
    statusEl.className = `alert alert-${type} alert-dismissible fade show`;
    statusEl.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (statusEl && statusEl.parentNode) {
            statusEl.remove();
        }
    }, 3000);
}

// Initialize with some sample data if empty
if (!localStorage.getItem('company-dashboard-todos')) {
    setTimeout(loadSampleData, 1000);
}

// Theme Toggle Functions

// Initialize theme
function initTheme() {
    const savedTheme = localStorage.getItem('company-dashboard-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Use saved theme, else system preference, else light
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    setTheme(theme);
}

// Set theme
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('company-dashboard-theme', theme);
    
    // Update icon
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
    }
    
    // Update button title
    const button = document.getElementById('theme-toggle');
    if (button) {
        button.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    }
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Auto-sync every 2 minutes if token is set
setInterval(() => {
    if (getGitHubToken()) {
        syncWithGitHub();
    }
}, 2 * 60 * 1000);
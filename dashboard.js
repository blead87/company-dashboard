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

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadTodos();
    setupEventListeners();
    updateLastSync();
    
    // Auto-refresh every 5 minutes
    setInterval(loadTodos, 5 * 60 * 1000);
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

// Save todos (to local storage, GitHub via manual sync)
function saveTodos() {
    // Save to local storage
    localStorage.setItem('company-dashboard-todos', JSON.stringify(todos));
    
    // Update last sync time
    lastSyncTime = new Date();
    updateLastSync();
    
    // Note: GitHub sync would require GitHub API with authentication
    // For now, we'll use local storage and manual GitHub updates
    console.log('Todos saved locally. Use "Sync to GitHub" button to push to repo.');
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
    
    if (todoList.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-check2-circle display-6 mb-3"></i>
                <p>No tasks found. Add your first task!</p>
            </div>
        `;
        return;
    }
    
    // Sort by: overdue first, then priority, then due date
    const sortedTodos = [...todoList].sort((a, b) => {
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
function addTodo(description, company, priority, dueDate = null, notes = '') {
    const newTodo = {
        id: Date.now().toString(),
        description: description.trim(),
        company: company,
        priority: priority,
        dueDate: dueDate,
        notes: notes.trim(),
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
            
            addTodo(description, company, priority, dueDate, notes);
            
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

// Initialize with some sample data if empty
if (!localStorage.getItem('company-dashboard-todos')) {
    setTimeout(loadSampleData, 1000);
}
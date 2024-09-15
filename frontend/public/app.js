const apiUrl = 'http://localhost:8000';
let token = localStorage.getItem('token');

const mainContent = document.getElementById('mainContent');
const homeBtn = document.getElementById('homeBtn');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

homeBtn.addEventListener('click', showHome);
registerBtn.addEventListener('click', showRegisterForm);
loginBtn.addEventListener('click', showLoginForm);
logoutBtn.addEventListener('click', logout);

function updateNavigation() {
    if (token) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        loginBtn.style.display = 'inline-block';
        registerBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
    }
}

async function showHome() {
    try {
        const response = await fetch(`${apiUrl}/threads/`);
        const threads = await response.json();
        let html = '<h2>Threads</h2>';
        html += '<button onclick="showCreateThreadForm()">Create New Thread</button>';
        threads.forEach(thread => {
            html += `
                <div class="thread">
                    <h3>${thread.title}</h3>
                    <p>${thread.text}</p>
                    <button onclick="showThread(${thread.id})">View Replies</button>
                </div>
            `;
        });
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Error fetching threads');
    }
}

function showRegisterForm() {
    mainContent.innerHTML = `
        <h2>Register</h2>
        <form id="registerForm">
            <input type="text" id="regUsername" placeholder="Username" required>
            <input type="password" id="regPassword" placeholder="Password" required>
            <button type="submit">Register</button>
        </form>
    `;
    document.getElementById('registerForm').addEventListener('submit', register);
}

function showLoginForm() {
    mainContent.innerHTML = `
        <h2>Login</h2>
        <form id="loginForm">
            <input type="text" id="loginUsername" placeholder="Username" required>
            <input type="password" id="loginPassword" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
    `;
    document.getElementById('loginForm').addEventListener('submit', login);
}

async function register(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    try {
        const response = await fetch(`${apiUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (response.ok) {
            showLoginForm();
            showMessage('Registration successful. Please log in.');
        } else {
            const error = await response.json();
            showError(error.detail);
        }
    } catch (error) {
        showError('Error during registration');
    }
}

async function login(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    try {
        const response = await fetch(`${apiUrl}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
        });
        if (response.ok) {
            const data = await response.json();
            token = data.access_token;
            localStorage.setItem('token', token);
            updateNavigation();
            showHome();
            showMessage('Login successful');
        } else {
            const error = await response.json();
            showError(error.detail);
        }
    } catch (error) {
        showError('Error during login');
    }
}

function logout() {
    token = null;
    localStorage.removeItem('token');
    updateNavigation();
    showHome();
    showMessage('Logout successful');
}

function showCreateThreadForm() {
    if (!token) {
        showError('You must be logged in to create a thread');
        return;
    }
    mainContent.innerHTML = `
        <h2>Create New Thread</h2>
        <form id="createThreadForm">
            <input type="text" id="threadTitle" placeholder="Thread Title" required>
            <textarea id="threadText" placeholder="Thread Content" required></textarea>
            <button type="submit">Create Thread</button>
        </form>
    `;
    document.getElementById('createThreadForm').addEventListener('submit', createThread);
}

async function createThread(e) {
    e.preventDefault();
    const title = document.getElementById('threadTitle').value;
    const text = document.getElementById('threadText').value;
    try {
        const response = await fetch(`${apiUrl}/threads/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, text })
        });
        if (response.ok) {
            showHome();
            showMessage('Thread created successfully');
        } else {
            const error = await response.json();
            showError(error.detail);
        }
    } catch (error) {
        showError('Error creating thread');
    }
}

async function showThread(threadId) {
    try {
        const threadResponse = await fetch(`${apiUrl}/threads/${threadId}`);
        const thread = await threadResponse.json();
        const repliesResponse = await fetch(`${apiUrl}/threads/${threadId}/replies/`);
        const replies = await repliesResponse.json();

        let html = `
            <h2>${thread.title}</h2>
            <p>${thread.text}</p>
            <h3>Replies</h3>
        `;

        replies.forEach(reply => {
            html += `
                <div class="reply">
                    <p>${reply.text}</p>
                </div>
            `;
        });

        html += `
            <h3>Add Reply</h3>
            <form id="replyForm">
                <textarea id="replyText" placeholder="Your reply" required></textarea>
                <button type="submit">Submit Reply</button>
            </form>
        `;

        mainContent.innerHTML = html;
        document.getElementById('replyForm').addEventListener('submit', e => createReply(e, threadId));
    } catch (error) {
        showError('Error fetching thread and replies');
    }
}

async function createReply(e, threadId) {
    e.preventDefault();
    if (!token) {
        showError('You must be logged in to reply');
        return;
    }
    const text = document.getElementById('replyText').value;
    try {
        const response = await fetch(`${apiUrl}/replies/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ thread_id: threadId, text })
        });
        if (response.ok) {
            showThread(threadId);
            showMessage('Reply added successfully');
        } else {
            const error = await response.json();
            showError(error.detail);
        }
    } catch (error) {
        showError('Error creating reply');
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    mainContent.insertBefore(errorDiv, mainContent.firstChild);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.textContent = message;
    mainContent.insertBefore(messageDiv, mainContent.firstChild);
    setTimeout(() => messageDiv.remove(), 5000);
}

// Initial setup
updateNavigation();
showHome();
const apiUrl = 'http://localhost:8000';
let token = localStorage.getItem('token');
let currentUser = null;

const mainContent = document.getElementById('mainContent');
const homeBtn = document.getElementById('homeBtn');
const usersBtn = document.getElementById('usersBtn');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usernameDisplay = document.getElementById('usernameDisplay');
const popup = document.getElementById('popup');

homeBtn.addEventListener('click', showHome);
usersBtn.addEventListener('click', showUsers);
registerBtn.addEventListener('click', showRegisterForm);
loginBtn.addEventListener('click', showLoginForm);
logoutBtn.addEventListener('click', logout);

function updateNavigation() {
    if (token) {
        getUserInfo();
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        currentUser = null;
        usernameDisplay.textContent = '';
        loginBtn.style.display = 'inline-block';
        registerBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
    }
}

// Attach event listeners after dynamically rendering content
function attachEventListeners() {
    document.querySelectorAll('.view-replies-btn').forEach(button => {
        button.addEventListener('click', () => showThread(button.dataset.threadId));
    });
    document.querySelectorAll('.create-thread-btn').forEach(button => {
        button.addEventListener('click', showCreateThreadForm);
    });
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', () => showEditThreadForm(button.dataset.threadId));
    });
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => deleteThread(button.dataset.threadId));
    });
    document.querySelectorAll('.reply-btn').forEach(button => {
        button.addEventListener('click', e => createReply(e, button.dataset.threadId));
    });
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', () => showEditThreadForm(button.dataset.threadId));
    });
    document.querySelectorAll('.delete-reply-btn').forEach(button => {
        button.addEventListener('click', () => deleteReply(button.dataset.replyId, button.dataset.threadId));
    });
    document.querySelectorAll('.edit-reply-btn').forEach(button => {
        button.addEventListener('click', () => showEditReplyForm(button.dataset.replyId, button.dataset.threadId));
    });
}

async function getUserInfo() {
    try {
        const response = await fetch(`${apiUrl}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        currentUser = await response.json();
        //usernameDisplay.textContent = `${currentUser.username}`;
        usernameDisplay.innerHTML = `<b>${currentUser.username}</b>`;
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
}

async function getUserWithId(userId) {
    try {
        const response = await fetch(`${apiUrl}/users/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            showError('Error fetching users');
            return null;
        }
        
        const users = await response.json();
        const user = users.find(user => user.id === userId);

        if (user) {
            return user;
        } else {
            showError(`User with ID ${userId} not found`);
            return null;
        }
    } catch (error) {
        showError('Error fetching users: ' + error.message);
        return null;
    }
}

async function showHome() {
    try {
        const response = await fetch(`${apiUrl}/threads/`);
        const threads = await response.json();
        let html = '<h2>Threads</h2>';
        if (token) {
            html += '<button style="margin-bottom: 10px;" class="create-thread-btn">Create New Thread</button>';
        }
        for (const thread of threads) {
            const user = await getUserWithId(thread.user_id); // Await user data
            html += `
                <div class="thread">
                    <h3>${thread.title}</h3>
                    <small><i><p>Written by <b>${user ? user.username : 'Unknown'}</b> on ${new Date(thread.created).toLocaleString()}${thread.edited ? ' (edited)' : ''}</p></i></small>
                    <p>${thread.text}</p>
                    <button class="view-replies-btn" data-thread-id="${thread.id}">View Replies</button>
                    ${getThreadControls(thread)}
                </div>
            `;
        }
        mainContent.innerHTML = html;
        attachEventListeners(); // Bind buttons after rendering
    } catch (error) {
        showError('Error fetching threads');
    }
}

function getThreadControls(thread) {
    if (!currentUser) return '';
    let controls = '';
    if (currentUser.id === thread.user_id) {
        controls += `<button class="edit-btn" data-thread-id="${thread.id}">Edit</button>`;
    }
    if (currentUser.is_admin) {
        controls += `<button class="delete-btn" data-thread-id="${thread.id}">Delete</button>`;
    }
    return controls;
}

async function makeAdmin(userId) {
    try {
        const response = await fetch(`${apiUrl}/users/${userId}/make-admin`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            
            searchUsers(); // Refresh the user list after making someone an admin
        } else {
            const error = await response.json();
            showError(`Failed to make admin: ${error.detail}`);
        }
    } catch (error) {
        showError('Error making admin: ' + error.message);
    }
}

async function removeAdmin(userId) {
    try {
        const response = await fetch(`${apiUrl}/users/${userId}/remove-admin`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            
            searchUsers(); // Refresh the user list after removing admin rights
        } else {
            const error = await response.json();
            showError(`Failed to remove admin: ${error.detail}`);
        }
    } catch (error) {
        showError('Error removing admin: ' + error.message);
    }
}

async function showUsers() {
    try {
        const response = await fetch(`${apiUrl}/users/`);
        const users = await response.json();

        let html = '<h2>Users</h2>';
        html += '<input type="text" id="userSearch" placeholder="Search by name">';
        html += '<div id="userList"></div>'; // This div will hold the user list

        mainContent.innerHTML = html;

        const userListDiv = document.getElementById('userList');
        users.forEach(user => {
            const adminLabel = user.is_admin ? `<span class="admin">(Admin)</span>` : '';

            // Only show "Make Admin" or "Remove Admin" buttons if the current user is logged in and is an admin
            let adminButton = '';

            if (currentUser && currentUser.is_admin) {
                // Do not show "Remove Admin" button for the current logged-in admin user
                if (user.is_admin && user.id !== currentUser.id) {
                    adminButton = `<button class="remove-admin-btn" data-user-id="${user.id}" style="background-color: red;">Remove Admin</button>`;
                } else if (!user.is_admin) {
                    adminButton = `<button class="make-admin-btn" data-user-id="${user.id}" style="background-color: orange;">Make Admin</button>`;
                }
            }

            userListDiv.innerHTML += `
                <div class="user-entry">
                    <p><b>${user.username}</b> <small><i>joined on ${new Date(user.created).toLocaleString()}</i></small> ${adminLabel} ${adminButton}</p>
                </div>
            `;
        });

        // Attach event listener to search input
        document.getElementById('userSearch').addEventListener('input', searchUsers);

        // Attach event listeners to the Make Admin and Remove Admin buttons
        document.querySelectorAll('.make-admin-btn').forEach(button => {
            button.addEventListener('click', () => makeAdmin(button.dataset.userId));
        });

        document.querySelectorAll('.remove-admin-btn').forEach(button => {
            button.addEventListener('click', () => removeAdmin(button.dataset.userId));
        });
    } catch (error) {
        showError('Error fetching users');
    }
}

async function searchUsers() {
    const searchValue = document.getElementById('userSearch').value.toLowerCase().trim();

    try {
        const response = await fetch(`${apiUrl}/users/`);
        const users = await response.json();

        const filteredUsers = searchValue
            ? users.filter(user => user.username.toLowerCase().includes(searchValue))
            : users; // If search is empty, show all users

        const userListDiv = document.getElementById('userList');
        userListDiv.innerHTML = ''; // Clear existing user list

        if (filteredUsers.length === 0) {
            userListDiv.innerHTML = `<p>No users found with the name "${searchValue}".</p>`;
        } else {
            filteredUsers.forEach(user => {
                const adminLabel = user.is_admin ? `<span class="admin">(Admin)</span>` : '';

                // Only show "Make Admin" or "Remove Admin" buttons if the current user is logged in and is an admin
                let adminButton = '';

                if (currentUser && currentUser.is_admin) {
                    // Do not show "Remove Admin" button for the current logged-in admin user
                    if (user.is_admin && user.id !== currentUser.id) {
                        adminButton = `<button class="remove-admin-btn" data-user-id="${user.id}" style="background-color: red;">Remove Admin</button>`;
                    } else if (!user.is_admin) {
                        adminButton = `<button class="make-admin-btn" data-user-id="${user.id}" style="background-color: orange;">Make Admin</button>`;
                    }
                }

                userListDiv.innerHTML += `
                    <div class="user-entry">
                        <p><b>${user.username}</b> <small><i>joined on ${new Date(user.created).toLocaleString()}</i></small> ${adminLabel} ${adminButton}</p>
                    </div>
                `;
            });

            // Attach event listeners to the Make Admin and Remove Admin buttons
            document.querySelectorAll('.make-admin-btn').forEach(button => {
                button.addEventListener('click', () => makeAdmin(button.dataset.userId));
            });

            document.querySelectorAll('.remove-admin-btn').forEach(button => {
                button.addEventListener('click', () => removeAdmin(button.dataset.userId));
            });
        }

    } catch (error) {
        showError('Error fetching users');
    }
}

async function showThread(threadId) {
    try {
        const threadResponse = await fetch(`${apiUrl}/threads/${threadId}`);
        const thread = await threadResponse.json();
        const repliesResponse = await fetch(`${apiUrl}/threads/${threadId}/replies/`);
        const replies = await repliesResponse.json();
        const user = await getUserWithId(thread.user_id); 

        let html = `
            <div class="thread">
                <h2>${thread.title}</h2>
                <small><i><p>Written by <b>${user ? user.username : 'Unknown'}</b> on ${new Date(thread.created).toLocaleString()}${thread.edited ? ' (edited)' : ''}</p></i></small>
                <p>${thread.text}</p>
                ${getThreadControls(thread)}
            </div>
        `;
        
        if (currentUser) {
            html += `
                <h3>Add a reply:</h3>
                <form id="replyForm">
                    <textarea id="replyText" class="reply-textarea" placeholder="Your reply" required></textarea>
                    <button class="reply-btn" data-thread-id="${thread.id}" type="submit">Submit Reply</button>
                </form>
            `;
        }

        html += `<h3>Replies</h3>`;  

        for (const reply of replies) {
            const replyUser = await getUserWithId(reply.user_id);
            html += `
                <div class="reply">
                    <small><i><p>Replied by <b>${replyUser ? replyUser.username : 'Unknown'}</b> on ${new Date(reply.created).toLocaleString()}${reply.edited ? ' (edited)' : ''}</p></i></small>
                    <p>${reply.text}</p>
                    ${currentUser && currentUser.id === reply.user_id ? 
                        `<button class="edit-reply-btn" data-reply-id="${reply.id}" data-thread-id="${threadId}">Edit</button>` : ''}
                    ${currentUser && currentUser.is_admin ? 
                        `<button class="delete-reply-btn" data-reply-id="${reply.id}" data-thread-id="${threadId}">Delete</button>` : ''}
                </div>
            `;
        }

        mainContent.innerHTML = html;

        if (currentUser) {
            attachEventListeners();
        }

        // Add event listeners for new buttons
        document.querySelectorAll('.delete-reply-btn').forEach(button => {
            button.addEventListener('click', () => deleteReply(button.dataset.replyId, button.dataset.threadId));
        });
        document.querySelectorAll('.edit-reply-btn').forEach(button => {
            button.addEventListener('click', () => showEditReplyForm(button.dataset.replyId, button.dataset.threadId));
        });
    } catch (error) {
        showError('Error fetching thread and replies');
    }
}

function showEditThreadForm(threadId) {
    fetch(`${apiUrl}/threads/${threadId}`)
        .then(response => response.json())
        .then(thread => {
            mainContent.innerHTML = `
                <h2>Edit Thread</h2>
                <form id="editThreadForm" class="edit-thread-form">
                    <input type="text" id="editThreadTitle" value="${thread.title}" required class="thread-title-input">
                    <textarea id="editThreadText" class="reply-textarea" required>${thread.text}</textarea>
                    <div class="button-group">
                        <button type="submit" class="submit-btn">Update Thread</button>
                        <button type="button" class="cancel-btn">Cancel</button>
                    </div>
                </form>
            `;
            document.getElementById('editThreadForm').addEventListener('submit', (e) => editThread(e, threadId));
            document.querySelector('#editThreadForm .cancel-btn').addEventListener('click', () => {
                showThread(threadId);  // This will take the user back to the thread view
            });
        })
        .catch(error => showError('Error fetching thread details'));
}

async function editThread(e, threadId) {
    e.preventDefault();
    const title = document.getElementById('editThreadTitle').value;
    const text = document.getElementById('editThreadText').value;
    try {
        const response = await fetch(`${apiUrl}/threads/${threadId}/edit`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, text })
        });
        if (response.ok) {
            showThread(threadId);
            showMessage('Thread updated successfully');
        } else {
            const error = await response.json();
            showError(error.detail);
        }
    } catch (error) {
        showError('Error updating thread');
    }
}

function showEditReplyForm(replyId, threadId) {
    fetch(`${apiUrl}/replies/${replyId}`)
        .then(response => response.json())
        .then(reply => {
            const replyElement = document.querySelector(`.reply button[data-reply-id="${replyId}"]`).closest('.reply');
            const originalContent = replyElement.innerHTML;
            
            // Ensure we're using the correct property for the reply text
            const replyText = reply.text || '';  // Use an empty string as fallback
            
            replyElement.innerHTML = `
                <form id="editReplyForm-${replyId}" class="edit-reply-form">
                    <textarea id="editReplyText-${replyId}" class="reply-textarea" required>${replyText}</textarea>
                    <button type="submit" class="submit-btn">Update Reply</button>
                    <button type="button" class="cancel-btn">Cancel</button>
                </form>
            `;
            document.getElementById(`editReplyForm-${replyId}`).addEventListener('submit', (e) => editReply(e, replyId, threadId));
            document.querySelector(`#editReplyForm-${replyId} .cancel-btn`).addEventListener('click', () => {
                replyElement.innerHTML = originalContent;
                attachEventListeners();
            });
        })
        .catch(error => {
            console.error('Error fetching reply details:', error);
            showError('Error fetching reply details');
        });
}

async function editReply(e, replyId, threadId) {
    e.preventDefault();
    const text = document.getElementById(`editReplyText-${replyId}`).value;
    try {
        const response = await fetch(`${apiUrl}/replies/${replyId}/edit`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text })
        });
        if (response.ok) {
            showThread(threadId);
            showMessage('Reply updated successfully');
        } else {
            const error = await response.json();
            showError(error.detail);
        }
    } catch (error) {
        console.error('Error updating reply:', error);
        showError('Error updating reply');
    }
}

function showCreateThreadForm() {
    if (!token) {
        showError('You must be logged in to create a thread');
        return;
    }
    mainContent.innerHTML = `
        <h2>Create New Thread</h2>
        <form id="createThreadForm" class="create-thread-form">
            <input type="text" id="threadTitle" placeholder="Thread Title" required class="thread-title-input">
            <textarea id="threadText" class="reply-textarea" placeholder="Thread Content" required></textarea>
            <button type="submit" class="submit-btn">Create Thread</button>
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

async function createReply(e, threadId) {
    e.preventDefault();

    if (!token) {
        showError('You must be logged in to reply.');
        return;
    }

    const text = document.getElementById('replyText').value.trim();  // Ensure no leading/trailing whitespace

    if (!text) {
        showError('Reply text cannot be empty.');
        return;
    }

    // Convert threadId to an integer
    const integerThreadId = parseInt(threadId, 10);

    if (isNaN(integerThreadId)) {
        showError('Invalid thread ID.');
        return;
    }

    const payload = {
        thread_id: integerThreadId,   // Ensure thread_id is sent correctly
        text: text
    };

    try {
        const response = await fetch(`${apiUrl}/replies/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)  // Send thread_id and text in body
        });

        if (response.ok) {
            showThread(threadId);  // Refresh replies after posting
            showMessage('Reply added successfully.');
        } else {
            const error = await response.json();
            showError(error.detail || 'Failed to create reply.');
        }
    } catch (error) {
        showError('Error creating reply: ' + error.message);
    }
}

async function deleteReply(replyId, threadId) {
    if (!currentUser || !currentUser.is_admin) return;
    try {
        const response = await fetch(`${apiUrl}/replies/${replyId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            showThread(threadId);
            showMessage('Reply deleted successfully');
        } else {
            const error = await response.json();
            showError(error.detail);
        }
    } catch (error) {
        showError('Error deleting reply');
    }
}

async function deleteThread(threadId) {
    if (!currentUser || !currentUser.is_admin) return;
    try {
        const response = await fetch(`${apiUrl}/threads/${threadId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            showHome();
            showMessage('Thread deleted successfully');
        } else {
            const error = await response.json();
            showError(error.detail);
        }
    } catch (error) {
        showError('Error deleting thread');
    }
}

function showRegisterForm() {
    mainContent.innerHTML = `
        <h2>Register</h2>
        <form id="registerForm">
            <input type="text" id="regUsername" placeholder="Username" required>
            <input type="password" id="regPassword" placeholder="Password" required>
            <input type="password" id="regPasswordConfirm" placeholder="Confirm Password" required>
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
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;

    if (password !== passwordConfirm) {
        showError('Passwords do not match');
        return;
    }

    try {
        const response = await fetch(`${apiUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (response.ok) {
            const userData = await response.json();
            loginUser(userData.username, password);
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
    loginUser(username, password);
}

async function loginUser(username, password) {
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

function showError(message) {
    popup.classList.remove('hidden');
    popup.textContent = message;
    setTimeout(() => popup.classList.add('hidden'), 1000);
}

function showMessage(message) {
    popup.classList.remove('hidden');
    popup.textContent = message;
    setTimeout(() => popup.classList.add('hidden'), 1000);
}

// Initialize the app with the home page and correct navigation state
updateNavigation();
showHome();

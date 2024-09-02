const apiUrl = 'http://localhost:8000';

// DOM Elements
const threadsList = document.getElementById('threads-list');
const repliesList = document.getElementById('replies-list');
const repliesSection = document.getElementById('replies-section');
const createThreadForm = document.getElementById('thread-form');
const createReplyForm = document.getElementById('reply-form');
const threadFormTitle = document.getElementById('title');
const threadFormText = document.getElementById('text');
const replyFormText = document.getElementById('reply-text');

let selectedThreadId = null;

// Fetch and display threads
async function loadThreads() {
    const response = await fetch(`${apiUrl}/threads/`);
    const threads = await response.json();
    threadsList.innerHTML = threads.map(thread => `
        <div class="thread" onclick="selectThread(${thread.id})">
            <div class="thread-title">${thread.title}</div>
            <div class="thread-text">${thread.text}</div>
            <div class="thread-date">${new Date(thread.created).toLocaleString()}</div>
        </div>
    `).join('');
}

// Select a thread and load replies
async function selectThread(threadId) {
    selectedThreadId = threadId;
    repliesSection.style.display = 'block';
    const response = await fetch(`${apiUrl}/threads/${threadId}/replies/`);
    const replies = await response.json();
    repliesList.innerHTML = replies.map(reply => `
        <div class="reply">
            <div class="reply-text">${reply.text}</div>
            <div class="reply-date">${new Date(reply.created).toLocaleString()}</div>
        </div>
    `).join('');
}

// Handle thread creation
createThreadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = threadFormTitle.value;
    const text = threadFormText.value;
    await fetch(`${apiUrl}/threads/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text })
    });
    threadFormTitle.value = '';
    threadFormText.value = '';
    loadThreads();
});

// Handle reply creation
createReplyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (selectedThreadId === null) {
        alert('Please select a thread first.');
        return;
    }
    const text = replyFormText.value;
    await fetch(`${apiUrl}/replies/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: selectedThreadId, text })
    });
    replyFormText.value = '';
    selectThread(selectedThreadId); // Reload replies for the selected thread
});

// Initial load
loadThreads();

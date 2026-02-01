// Admin panel JavaScript
const API_BASE = 'http://localhost:3000';

// Auth check - redirect to login if not authenticated
(async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
    if (!res.ok) {
      // Don't redirect if we're already on the login page
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
      }
      return;
    }
    const user = await res.json();
    const userEl = document.getElementById('admin-user');
    if (userEl) userEl.textContent = `Logged in as ${user.username}`;
  } catch {
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = 'login.html';
    }
  }
})();

// Logout handler
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch {}
    window.location.href = 'login.html';
  });
}

// Dashboard: load posts
const postsListEl = document.getElementById('posts-list');
if (postsListEl) {
  loadDashboardPosts();
}

async function loadDashboardPosts() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/posts`, { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) { window.location.href = 'login.html'; return; }
      throw new Error('Failed to load posts');
    }

    const posts = await res.json();

    if (posts.length === 0) {
      postsListEl.innerHTML = `
        <div class="empty-state">
          <p>No blog posts yet.</p>
          <p class="text-muted">Click "New Post" to create your first blog entry.</p>
        </div>`;
      return;
    }

    postsListEl.innerHTML = `
      <table class="posts-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Author</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${posts.map(post => `
            <tr>
              <td>${escapeHtml(post.title)}</td>
              <td>${escapeHtml(post.author)}</td>
              <td>${formatDate(post.created_at)}</td>
              <td class="actions">
                <a href="editor.html?id=${post.id}">Edit</a>
                <a href="#" class="delete-link" data-id="${post.id}" data-title="${escapeHtml(post.title)}">Delete</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    // Attach delete handlers
    postsListEl.querySelectorAll('.delete-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = link.dataset.id;
        const title = link.dataset.title;

        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

        try {
          const res = await fetch(`${API_BASE}/api/admin/posts/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (!res.ok) {
            if (res.status === 401) { window.location.href = 'login.html'; return; }
            alert('Failed to delete post');
            return;
          }

          loadDashboardPosts();
        } catch {
          alert('Could not connect to server');
        }
      });
    });
  } catch (err) {
    postsListEl.innerHTML = `
      <div class="empty-state">
        <p>Could not load posts. Make sure the API server is running.</p>
      </div>`;
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

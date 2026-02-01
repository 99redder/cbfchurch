// Single blog post loader
(async function () {
  const container = document.getElementById('post-content');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    container.innerHTML = '<div class="empty-state"><p>Post not found.</p><a href="index.html" class="back-link">&larr; Back to Home</a></div>';
    return;
  }

  try {
    const post = await apiFetch(`/api/posts/${encodeURIComponent(slug)}`);

    document.title = `${post.title} | Christian Believers Fellowship`;

    container.innerHTML = `
      <article class="post-full card">
        <h1>${escapeHtml(post.title)}</h1>
        <div class="post-meta mb-2">
          <span>${formatDate(post.created_at)}</span>
          <span>${escapeHtml(post.author)}</span>
        </div>
        <div class="post-content">${post.content}</div>
        <a href="index.html" class="back-link">&larr; Back to Home</a>
      </article>`;
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Post not found.</p>
        <a href="index.html" class="back-link">&larr; Back to Home</a>
      </div>`;
  }
})();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

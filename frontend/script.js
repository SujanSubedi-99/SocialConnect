class SocialConnect {
    constructor() {
        this.API_BASE = '/api';
        this.token = localStorage.getItem('token');
        this.currentUser = null;
        this.currentPostId = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        
        if (this.token) {
            this.loadCurrentUser();
            this.showMainApp();
        } else {
            this.showAuthModal();
        }
    }

    bindEvents() {
        // Auth events
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('auth-switch-btn').addEventListener('click', () => this.toggleAuthForm());
        
        // Navigation events
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        
        // Post events
        document.getElementById('post-submit').addEventListener('click', () => this.createPost());
        document.getElementById('add-image-btn').addEventListener('click', () => this.toggleImageInput());
        
        // Comments events
        document.getElementById('comments-close').addEventListener('click', () => this.closeCommentsModal());
        document.getElementById('comment-submit').addEventListener('click', () => this.addComment());
        
        // Search events
        document.getElementById('search-input').addEventListener('input', (e) => this.handleSearch(e));
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
        
        // Modal events
        document.getElementById('auth-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                // Don't close auth modal by clicking outside
            }
        });
        
        document.getElementById('comments-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeCommentsModal();
            }
        });
    }

    // API Methods
    async apiCall(endpoint, options = {}) {
        const url = `${this.API_BASE}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options,
        };

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Authentication
    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await this.apiCall('/login', {
                method: 'POST',
                body: { username, password },
            });

            this.token = response.token;
            this.currentUser = response.user;
            localStorage.setItem('token', this.token);
            
            this.hideAuthModal();
            this.showMainApp();
            this.showToast('Welcome back!', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const fullName = document.getElementById('register-fullname').value;
        const bio = document.getElementById('register-bio').value;
        const password = document.getElementById('register-password').value;

        try {
            const response = await this.apiCall('/register', {
                method: 'POST',
                body: { username, email, password, fullName, bio },
            });

            this.token = response.token;
            this.currentUser = response.user;
            localStorage.setItem('token', this.token);
            
            this.hideAuthModal();
            this.showMainApp();
            this.showToast('Welcome to SocialConnect!', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    handleLogout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('token');
        
        this.showAuthModal();
        this.hideMainApp();
        this.showToast('Logged out successfully', 'success');
    }

    async loadCurrentUser() {
        try {
            this.currentUser = await this.apiCall('/me');
            this.updateUserAvatars();
        } catch (error) {
            console.error('Failed to load user:', error);
            this.handleLogout();
        }
    }

    updateUserAvatars() {
        if (this.currentUser?.avatar) {
            document.getElementById('create-post-avatar').src = this.currentUser.avatar;
        }
    }

    // UI Methods
    toggleAuthForm() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const switchBtn = document.getElementById('auth-switch-btn');
        const switchText = document.getElementById('auth-switch-text');
        const title = document.getElementById('auth-title');
        
        if (loginForm.classList.contains('hidden')) {
            // Show login form
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            switchBtn.textContent = 'Sign up';
            switchText.textContent = "Don't have an account?";
            title.textContent = 'Welcome back';
        } else {
            // Show register form
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            switchBtn.textContent = 'Sign in';
            switchText.textContent = 'Already have an account?';
            title.textContent = 'Join SocialConnect';
        }
    }

    showAuthModal() {
        document.getElementById('auth-modal').classList.add('show');
    }

    hideAuthModal() {
        document.getElementById('auth-modal').classList.remove('show');
    }

    showMainApp() {
        document.getElementById('navbar').style.display = 'block';
        document.getElementById('feed-page').classList.remove('hidden');
        this.loadFeed();
    }

    hideMainApp() {
        document.getElementById('navbar').style.display = 'none';
        document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    }

    handleNavigation(e) {
        e.preventDefault();
        
        const page = e.currentTarget.dataset.page;
        
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Show corresponding page
        document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
        document.getElementById(`${page}-page`).classList.remove('hidden');
        
        if (page === 'feed') {
            this.loadFeed();
        } else if (page === 'profile') {
            this.loadProfile();
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Posts
    async loadFeed() {
        const container = document.getElementById('posts-container');
        const loading = document.getElementById('posts-loading');
        
        loading.style.display = 'flex';
        
        try {
            const posts = await this.apiCall('/posts');
            this.renderPosts(posts);
        } catch (error) {
            this.showToast('Failed to load posts', 'error');
        } finally {
            loading.style.display = 'none';
        }
    }

    renderPosts(posts) {
        const container = document.getElementById('posts-container');
        const loading = document.getElementById('posts-loading');
        
        // Clear existing posts except loading
        const existingPosts = container.querySelectorAll('.post');
        existingPosts.forEach(post => post.remove());
        
        if (posts.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <h3>No posts yet</h3>
                    <p>Be the first to share something!</p>
                </div>
            `;
            container.appendChild(emptyState);
            return;
        }
        
        posts.forEach(post => {
            const postElement = this.createPostElement(post);
            container.appendChild(postElement);
        });
    }

    createPostElement(post) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post';
        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${post.avatar || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=400'}" alt="${post.username}" class="post-avatar">
                <div class="post-author">
                    <h4>${post.full_name || post.username}</h4>
                    <p>@${post.username}</p>
                </div>
                <span class="post-time">${this.formatDate(post.created_at)}</span>
            </div>
            <div class="post-content">
                <p class="post-text">${post.content}</p>
                ${post.image_url ? `<img src="${post.image_url}" alt="Post image" class="post-image">` : ''}
            </div>
            <div class="post-actions">
                <button class="post-action ${post.is_liked ? 'liked' : ''}" onclick="app.toggleLike(${post.id})">
                    <i class="fas fa-heart"></i>
                    <span>${post.like_count}</span>
                </button>
                <button class="post-action" onclick="app.showComments(${post.id})">
                    <i class="fas fa-comment"></i>
                    <span>${post.comment_count}</span>
                </button>
            </div>
        `;
        return postDiv;
    }

    async createPost() {
        const content = document.getElementById('post-content').value.trim();
        const imageUrl = document.getElementById('post-image-url').value.trim();

        if (!content) {
            this.showToast('Please write something', 'error');
            return;
        }

        try {
            await this.apiCall('/posts', {
                method: 'POST',
                body: { content, imageUrl: imageUrl || null },
            });

            document.getElementById('post-content').value = '';
            document.getElementById('post-image-url').value = '';
            document.getElementById('post-image-url').classList.add('hidden');
            
            this.loadFeed();
            this.showToast('Post created successfully!', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    toggleImageInput() {
        const imageInput = document.getElementById('post-image-url');
        imageInput.classList.toggle('hidden');
        if (!imageInput.classList.contains('hidden')) {
            imageInput.focus();
        }
    }

    async toggleLike(postId) {
        try {
            await this.apiCall(`/posts/${postId}/like`, {
                method: 'POST',
            });
            
            this.loadFeed(); // Refresh to show updated like count
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    // Comments
    async showComments(postId) {
        this.currentPostId = postId;
        document.getElementById('comments-modal').classList.add('show');
        
        try {
            const comments = await this.apiCall(`/posts/${postId}/comments`);
            this.renderComments(comments);
        } catch (error) {
            this.showToast('Failed to load comments', 'error');
        }
    }

    renderComments(comments) {
        const container = document.getElementById('comments-container');
        
        if (comments.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-comment" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <p>No comments yet. Be the first to comment!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = comments.map(comment => `
            <div class="comment">
                <img src="${comment.avatar || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=400'}" alt="${comment.username}" class="comment-avatar">
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${comment.full_name || comment.username}</span>
                        <span class="comment-time">${this.formatDate(comment.created_at)}</span>
                    </div>
                    <p class="comment-text">${comment.content}</p>
                </div>
            </div>
        `).join('');
    }

    async addComment() {
        const content = document.getElementById('comment-content').value.trim();

        if (!content) {
            this.showToast('Please write a comment', 'error');
            return;
        }

        try {
            await this.apiCall(`/posts/${this.currentPostId}/comments`, {
                method: 'POST',
                body: { content },
            });

            document.getElementById('comment-content').value = '';
            
            // Reload comments
            const comments = await this.apiCall(`/posts/${this.currentPostId}/comments`);
            this.renderComments(comments);
            
            // Refresh feed to update comment count
            this.loadFeed();
            
            this.showToast('Comment added!', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    closeCommentsModal() {
        document.getElementById('comments-modal').classList.remove('show');
        this.currentPostId = null;
    }

    // Profile
    async loadProfile() {
        if (!this.currentUser) return;

        try {
            const profile = await this.apiCall(`/users/${this.currentUser.username}`);
            this.renderProfile(profile);
        } catch (error) {
            this.showToast('Failed to load profile', 'error');
        }
    }

    renderProfile(profile) {
        document.getElementById('profile-avatar').src = profile.avatar || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=400';
        document.getElementById('profile-name').textContent = profile.full_name || profile.username;
        document.getElementById('profile-username').textContent = `@${profile.username}`;
        document.getElementById('profile-bio').textContent = profile.bio || 'No bio available';
        document.getElementById('profile-posts').textContent = profile.post_count || 0;
        document.getElementById('profile-followers').textContent = profile.followers_count || 0;
        document.getElementById('profile-following').textContent = profile.following_count || 0;
    }

    // Search
    async handleSearch(e) {
        const query = e.target.value.trim();
        const resultsContainer = document.getElementById('search-results');
        
        if (query.length < 2) {
            resultsContainer.style.display = 'none';
            return;
        }

        try {
            const users = await this.apiCall(`/search/users?q=${encodeURIComponent(query)}`);
            this.renderSearchResults(users);
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    renderSearchResults(users) {
        const container = document.getElementById('search-results');
        
        if (users.length === 0) {
            container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">No users found</div>';
        } else {
            container.innerHTML = users.map(user => `
                <div class="search-result" onclick="app.viewUserProfile('${user.username}')">
                    <img src="${user.avatar || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=400'}" alt="${user.username}">
                    <div>
                        <div style="font-weight: 500;">${user.full_name || user.username}</div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">@${user.username}</div>
                    </div>
                </div>
            `).join('');
        }
        
        container.style.display = 'block';
    }

    handleOutsideClick(e) {
        const searchContainer = document.getElementById('nav-search');
        const resultsContainer = document.getElementById('search-results');
        
        if (!searchContainer.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    }

    viewUserProfile(username) {
        // For now, just close search results
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('search-input').value = '';
        
        // In a full implementation, you would navigate to the user's profile
        this.showToast(`Viewing ${username}'s profile (feature coming soon!)`, 'success');
    }

    // Utility Methods
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now - date;
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 1) {
            return 'now';
        } else if (diffInMinutes < 60) {
            return `${diffInMinutes}m`;
        } else if (diffInHours < 24) {
            return `${diffInHours}h`;
        } else if (diffInDays < 7) {
            return `${diffInDays}d`;
        } else {
            return date.toLocaleDateString();
        }
    }
}

// Initialize the app
const app = new SocialConnect();
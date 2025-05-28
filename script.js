// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', () => {
    // Get all links that have a hash
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const targetId = link.getAttribute('href');
            if (targetId === '#') return; // Skip if it's just "#"
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const navbarHeight = document.querySelector('.navbar').offsetHeight;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navbarHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth',
                    duration: 1000 // Added duration for smoother animation
                });

                // Add active state to the clicked link
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Remove active state after scrolling is complete
                setTimeout(() => {
                    link.classList.remove('active');
                }, 1000);
            }
        });
    });
});

// Modal handling
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('loginModal');
    const closeModal = document.querySelector('#loginModal .close-modal');
    const ctaButtons = document.querySelectorAll('.cta-button, .get-started-btn');

    if (modal && closeModal && ctaButtons) {
        // Open modal when CTA buttons are clicked
        ctaButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                modal.style.display = 'flex';
                setTimeout(() => {
                    modal.classList.add('show');
                }, 10);
                document.body.style.overflow = 'hidden'; // Prevent scrolling
            });
        });

        // Close modal when clicking the close button
        closeModal.addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
            document.body.style.overflow = ''; // Restore scrolling
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
                document.body.style.overflow = ''; // Restore scrolling
            }
        });
    }
});

// Function to update user profile in dashboard
function updateUserProfile() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            throw new Error('No user data found');
        }

        const username = document.querySelector('.username');
        const profilePic = document.querySelector('.profile-pic');
        
        if (username && profilePic) {
            // For Google Sign-In, the name might be in different fields
            const displayName = user.given_name || user.name || user.email.split('@')[0];
            username.textContent = displayName;
            
            // Update profile picture if available
            if (user.picture) {
                profilePic.src = user.picture;
                profilePic.alt = displayName;
            }
            
            console.log('Updated profile:', { name: displayName, picture: user.picture });
        } else {
            console.warn('Profile elements not found in DOM');
        }
    } catch (error) {
        console.error('Error updating user profile:', error);
        // Don't throw error, just log it
    }
}

// Function to decode JWT token
function decodeJwtResponse(token) {
    if (!window.jwt_decode) {
        throw new Error('JWT decode library not loaded');
    }
    try {
        return window.jwt_decode(token);
    } catch (error) {
        console.error('Error decoding JWT:', error);
        throw error;
    }
}

// Google OAuth Configuration
function handleCredentialResponse(response) {
    console.log('Google Sign-In response received:', response);
    
    if (!response || !response.credential) {
        console.error('Invalid response from Google Sign-In');
        alert('Sign in failed. Please try again.');
        return;
    }

    try {
        const credential = response.credential;
        console.log('Attempting to decode JWT token');
        const decoded = decodeJwtResponse(credential);
        console.log('Successfully decoded token:', decoded);
        
        if (!decoded.email) {
            throw new Error('No email found in decoded token');
        }
        
        // Save user data to localStorage
        localStorage.setItem('user', JSON.stringify(decoded));
        console.log('User data saved to localStorage');
        
        // Save user data to server
        saveUserToDatabase(decoded)
            .then(() => {
                console.log('User saved to database, redirecting to dashboard...');
                window.location.href = 'dashboard.html';
            })
            .catch(error => {
                console.error('Error saving to server:', error);
                // Still redirect even if server save fails
                console.log('Redirecting to dashboard despite server error...');
                window.location.replace('dashboard.html');
            });
    } catch (error) {
        console.error('Error in handleCredentialResponse:', error);
        // Clear any potentially corrupted data
        localStorage.removeItem('user');
        alert('An error occurred during sign in. Please try again.');
    }
}

const API_URL = 'https://tradetrack-58el.onrender.com';  // Render.com deployed backend URL

async function saveUserToDatabase(googleUser) {
    try {
        console.log('Making request to:', `${API_URL}/api/user`);
        
        // First try to check if the server is reachable
        try {
            const statusResponse = await fetch(`${API_URL}/status`);
            const statusData = await statusResponse.json();
            if (!statusData || statusData.mongodb === 'disconnected') {
                throw new Error('Server is not ready. Please try again in a few moments.');
            }
        } catch (statusError) {
            throw new Error('Cannot connect to server. Please check your internet connection and try again.');
        }
        
        const response = await fetch(`${API_URL}/api/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: googleUser.email,
                name: googleUser.name,
                picture: googleUser.picture
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data) {
            throw new Error('No data received from server');
        }
        
        return data;
    } catch (error) {
        console.error('Error in saveUserToDatabase:', error);
        throw new Error(`Server connection failed: ${error.message}. Please try again later.`);
    }
}

async function getUserData(email) {
    const response = await fetch(`${API_URL}/api/user/${email}`);
    if (!response.ok) {
        throw new Error('Failed to fetch user data');
    }
    return response.json();
}

async function saveTrade(email, tradeData) {
    const response = await fetch(`${API_URL}/api/trade/${email}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(tradeData)
    });
    
    if (!response.ok) {
        throw new Error('Failed to save trade');
    }
    
    return response.json();
}

// Check authentication status
function checkAuth() {
    const user = localStorage.getItem('user');
    
    // Get the current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (!user) {
        // If no user and we're not already on the index page, redirect to index
        if (currentPage !== 'index.html') {
            console.log('No user found, redirecting to login page');
            window.location.replace('index.html');
        }
        return false;
    }

    try {
        // Parse user data to verify it's valid JSON
        const userData = JSON.parse(user);
        if (!userData.email) {
            console.error('Invalid user data found');
            localStorage.removeItem('user');
            if (currentPage !== 'index.html') {
                window.location.replace('index.html');
            }
            return false;
        }

        // If user exists and we're on index page, redirect to dashboard
        if (currentPage === 'index.html') {
            console.log('User already logged in, redirecting to dashboard');
            window.location.replace('dashboard.html');
            return false;
        }
        
        // Update dashboard if we're on the dashboard page
        if (currentPage === 'dashboard.html') {
            console.log('Updating dashboard with user data');
            
            // First update UI with local data
            updateUserProfile();
            
            // Then try to get updated data from server
            getUserData(userData.email)
                .then(updatedUser => {
                    if (updatedUser) {
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        updateDashboardMetrics(updatedUser);
                        if (updatedUser.trades) {
                            updateRecentTrades(updatedUser.trades);
                        }
                    }
                })
                .catch(error => {
                    console.warn('Error fetching user data from server:', error);
                    // Don't logout on server error, just show what we have
                });
        }
        
        return true;
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        if (currentPage !== 'index.html') {
            window.location.replace('index.html');
        }
        return false;
    }
}

function updateDashboardMetrics(user) {
    // Update total profit/loss
    document.querySelector('.profit .value').textContent = 
        `₹${user.metrics.total_profit_loss.toFixed(2)}`;
    
    // Update total trades
    document.querySelector('.trades .value').textContent = 
        user.metrics.total_trades.toString();
    
    // Update win rate
    document.querySelector('.win-rate .value').textContent = 
        `${user.metrics.win_rate.toFixed(1)}%`;
    
    // Update average return
    document.querySelector('.avg-return .value').textContent = 
        `₹${user.metrics.average_return.toFixed(2)}`;
}

function updateRecentTrades(trades) {
    const tradesList = document.querySelector('.trades-list');
    tradesList.innerHTML = '';
    
    const recentTrades = trades.slice(-3).reverse();
    
    recentTrades.forEach(trade => {
        const tradeItem = document.createElement('div');
        tradeItem.className = `trade-item ${trade.profit_loss > 0 ? 'profit' : 'loss'}`;
        
        tradeItem.innerHTML = `
            <div class="trade-info">
                <h4>${trade.symbol}</h4>
                <p class="trade-time">${new Date(trade.date).toLocaleString()}</p>
            </div>
            <div class="trade-result">
                <p class="${trade.profit_loss > 0 ? 'profit' : 'loss'}">
                    ${trade.profit_loss > 0 ? '+' : ''}₹${trade.profit_loss.toFixed(2)}
                </p>
                <span class="percentage">
                    ${((trade.exit - trade.entry) / trade.entry * 100).toFixed(1)}%
                </span>
            </div>
        `;
        
        tradesList.appendChild(tradeItem);
    });
}

function handleLogout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Add this function to check auth status when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// Navbar background effect on scroll
const navbar = document.querySelector('.navbar');
let lastScrollTop = 0;

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Add/remove background color based on scroll position
    if (scrollTop > 50) {
        navbar.style.backgroundColor = 'rgba(10, 10, 10, 0.95)';
    } else {
        navbar.style.backgroundColor = 'transparent';
    }
    
    // Hide/show navbar based on scroll direction
    if (scrollTop > lastScrollTop) {
        navbar.style.transform = 'translateY(-100%)';
    } else {
        navbar.style.transform = 'translateY(0)';
    }
    
    lastScrollTop = scrollTop;
});

// Intersection Observer for fade-in animations
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Add fade-in animation to elements
document.querySelectorAll('.feature-card, .testimonial, .about-content').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(el);
});

// Add class for fade-in animation
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');
});

// Add styles for animations
const style = document.createElement('style');
style.textContent = `
    .fade-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
    
    .loaded {
        opacity: 1;
    }
`;
document.head.appendChild(style);

// Testimonial slider navigation
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.querySelector('.testimonials-slider');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const slideWidth = 420; // card width + gap

    if (slider && prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            slider.scrollBy({
                left: -slideWidth,
                behavior: 'smooth'
            });
        });

        nextBtn.addEventListener('click', () => {
            slider.scrollBy({
                left: slideWidth,
                behavior: 'smooth'
            });
        });

        // Hide/show navigation buttons based on scroll position
        slider.addEventListener('scroll', () => {
            const isAtStart = slider.scrollLeft === 0;
            const isAtEnd = slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 1;

            prevBtn.style.opacity = isAtStart ? '0.5' : '1';
            nextBtn.style.opacity = isAtEnd ? '0.5' : '1';
            prevBtn.style.cursor = isAtStart ? 'default' : 'pointer';
            nextBtn.style.cursor = isAtEnd ? 'default' : 'pointer';
        });
    }
});

// Settings Modal Functionality
document.addEventListener('DOMContentLoaded', () => {
    const settingsModal = document.getElementById('settingsModal');
    const settingsLink = document.querySelector('.nav-links a[href="#"]:has(i.fa-cog)');
    const closeSettingsModal = settingsModal.querySelector('.close-modal');
    const saveSettingsBtn = settingsModal.querySelector('.save-settings-btn');
    const profilePreview = document.getElementById('profilePreview');

    // Open settings modal with corrected display style
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            const user = JSON.parse(localStorage.getItem('user'));
            if (user) {
                // Set default profile picture if user picture is not available
                const defaultProfilePic = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                
                // Update profile preview with user's picture or default
                if (profilePreview) {
                    profilePreview.src = user.picture || defaultProfilePic;
                    profilePreview.alt = user.name || 'Profile Picture';
                }

                // Update other settings fields
                document.getElementById('settingsName').value = user.name || '';
                document.getElementById('settingsEmail').value = user.email || '';
                
                // Fetch additional user settings from server
                fetch(`${API_URL}/api/user/${user.email}`)
                    .then(response => response.json())
                    .then(userData => {
                        document.getElementById('tradingCapital').value = userData.tradingCapital || '';
                        document.getElementById('tradingExperience').value = userData.tradingExperience || '';
                    })
                    .catch(error => console.error('Error fetching user settings:', error));
            }
            settingsModal.style.display = 'flex';
            settingsModal.classList.add('show');
        });
    } else {
        console.error('Settings link not found');
    }

    // Save settings
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                alert('Please log in to save settings');
                return;
            }

            const tradingCapital = document.getElementById('tradingCapital').value;
            const tradingExperience = document.getElementById('tradingExperience').value;

            try {
                // Log the request details
                console.log('Saving settings to:', `${API_URL}/api/user/${user.email}/settings`);
                console.log('Request payload:', {
                    tradingCapital: tradingCapital ? Number(tradingCapital) : undefined,
                    tradingExperience: tradingExperience || undefined
                });

                // First check if the server is reachable
                const statusCheck = await fetch(`${API_URL}/status`);
                if (!statusCheck.ok) {
                    throw new Error('Server is not responding. Please try again later.');
                }

                const response = await fetch(`${API_URL}/api/user/${user.email}/settings`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        tradingCapital: tradingCapital ? Number(tradingCapital) : undefined,
                        tradingExperience: tradingExperience || undefined
                    })
                });

                // Log the response status and headers
                console.log('Response status:', response.status);
                console.log('Response headers:', Object.fromEntries(response.headers.entries()));

                // Handle non-JSON responses
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Received non-JSON response:', text);
                    throw new Error('Server returned an invalid response. Please try again later.');
                }

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to save settings');
                }

                const updatedUser = await response.json();
                console.log('Settings updated successfully:', updatedUser);
                
                // Update local storage with new settings
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const updatedUserData = {
                    ...currentUser,
                    tradingCapital: updatedUser.tradingCapital,
                    tradingExperience: updatedUser.tradingExperience
                };
                
                localStorage.setItem('user', JSON.stringify(updatedUserData));

                alert('Settings saved successfully!');
                settingsModal.classList.remove('show');
                setTimeout(() => {
                    settingsModal.style.display = 'none';
                }, 300);
            } catch (error) {
                console.error('Error saving settings:', error);
                alert(error.message || 'Failed to save settings. Please try again.');
            }
        });
    }

    // Close settings modal with animation
    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', () => {
            settingsModal.classList.remove('show');
            setTimeout(() => {
                settingsModal.style.display = 'none';
            }, 300);
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('show');
            setTimeout(() => {
                settingsModal.style.display = 'none';
            }, 300);
        }
    });
});

// Mobile Navigation Handler
document.addEventListener('DOMContentLoaded', () => {
    const mobileNavBtn = document.querySelector('.mobile-nav');
    const dashboardNav = document.querySelector('.dashboard-nav');
    const overlay = document.querySelector('.overlay');
    
    if (mobileNavBtn && dashboardNav && overlay) {
        mobileNavBtn.addEventListener('click', () => {
            dashboardNav.classList.toggle('open');
            overlay.classList.toggle('show');
            document.body.style.overflow = dashboardNav.classList.contains('open') ? 'hidden' : '';
            
            // Toggle aria-expanded state
            mobileNavBtn.setAttribute('aria-expanded', 
                dashboardNav.classList.contains('open') ? 'true' : 'false'
            );
        });

        // Close nav when clicking overlay
        overlay.addEventListener('click', () => {
            dashboardNav.classList.remove('open');
            overlay.classList.remove('show');
            document.body.style.overflow = '';
            mobileNavBtn.setAttribute('aria-expanded', 'false');
        });

        // Close nav when clicking a link (for mobile)
        const navLinks = dashboardNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    dashboardNav.classList.remove('open');
                    overlay.classList.remove('show');
                    document.body.style.overflow = '';
                    mobileNavBtn.setAttribute('aria-expanded', 'false');
                }
            });
        });

        // Handle resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                dashboardNav.classList.remove('open');
                overlay.classList.remove('show');
                document.body.style.overflow = '';
                mobileNavBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Initialize aria-expanded state
        mobileNavBtn.setAttribute('aria-expanded', 'false');
    }
});

// Add Trade Modal HTML
const addTradeModalHTML = `
<div id="addTradeModal" class="modal">
    <div class="modal-content trade-modal">
        <span class="close-modal">&times;</span>
        <h2>Add New Trade</h2>
        <form id="addTradeForm" class="trade-form">
            <div class="form-group">
                <label for="tradeSymbol">Symbol</label>
                <input type="text" id="tradeSymbol" name="symbol" required placeholder="e.g., NIFTY, BANKNIFTY">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="tradeType">Type</label>
                    <select id="tradeType" name="type" required>
                        <option value="">Select Type</option>
                        <option value="LONG">Long</option>
                        <option value="SHORT">Short</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="tradeQuantity">Quantity</label>
                    <input type="number" id="tradeQuantity" name="quantity" required min="1" placeholder="1">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="entryPrice">Entry</label>
                    <input type="number" id="entryPrice" name="entry" required step="0.01" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label for="exitPrice">Exit</label>
                    <input type="number" id="exitPrice" name="exit" required step="0.01" placeholder="0.00">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="stopLoss">SL</label>
                    <input type="number" id="stopLoss" name="stopLoss" step="0.01" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label for="target">Target</label>
                    <input type="number" id="target" name="target" step="0.01" placeholder="0.00">
                </div>
            </div>
            <div class="form-group">
                <label for="tradeNotes">Notes</label>
                <textarea id="tradeNotes" name="notes" rows="2" placeholder="Add your trade notes here..."></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="cancel-trade-btn">Cancel</button>
                <button type="submit" class="submit-trade-btn">Add Trade</button>
            </div>
        </form>
    </div>
</div>`;

// Add the modal to the page when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    // Add trade modal to body
    document.body.insertAdjacentHTML('beforeend', addTradeModalHTML);
    
    // Add Trade button click handler
    const addTradeBtn = document.querySelector('.add-trade-btn');
    const addTradeModal = document.getElementById('addTradeModal');
    const closeModal = addTradeModal.querySelector('.close-modal');
    const cancelBtn = addTradeModal.querySelector('.cancel-trade-btn');
    const addTradeForm = document.getElementById('addTradeForm');

    function showAddTradeModal() {
        addTradeModal.style.display = 'flex';
        setTimeout(() => addTradeModal.classList.add('show'), 10);
    }

    function hideAddTradeModal() {
        addTradeModal.classList.remove('show');
        setTimeout(() => {
            addTradeModal.style.display = 'none';
            addTradeForm.reset();
        }, 300);
    }

    // Show modal when Add Trade button is clicked
    addTradeBtn.addEventListener('click', showAddTradeModal);

    // Hide modal when close button is clicked
    closeModal.addEventListener('click', hideAddTradeModal);
    cancelBtn.addEventListener('click', hideAddTradeModal);

    // Hide modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === addTradeModal) {
            hideAddTradeModal();
        }
    });

    // Handle form submission
    addTradeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(addTradeForm);
        const tradeData = {
            symbol: formData.get('symbol'),
            type: formData.get('type'),
            quantity: parseInt(formData.get('quantity')),
            entry: parseFloat(formData.get('entry')),
            exit: parseFloat(formData.get('exit')),
            stopLoss: formData.get('stopLoss') ? parseFloat(formData.get('stopLoss')) : null,
            target: formData.get('target') ? parseFloat(formData.get('target')) : null,
            notes: formData.get('notes'),
            date: new Date().toISOString()
        };

        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !user.email) {
                throw new Error('User not authenticated');
            }

            const response = await saveTrade(user.email, tradeData);
            console.log('Trade saved successfully:', response);
            
            // Update the dashboard
            const updatedUser = await getUserData(user.email);
            if (updatedUser) {
                localStorage.setItem('user', JSON.stringify(updatedUser));
                updateDashboardMetrics(updatedUser);
                updateRecentTrades(updatedUser.trades);
            }

            hideAddTradeModal();
            // Show success message
            alert('Trade added successfully!');
        } catch (error) {
            console.error('Error saving trade:', error);
            alert('Failed to save trade. Please try again.');
        }
    });
});

// Add these styles to your existing styles
const tradeModalStyles = `
.trade-modal {
    max-width: 600px;
    width: 90%;
}

.trade-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.form-row {
    display: flex;
    gap: 1rem;
}

.form-row .form-group {
    flex: 1;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-group label {
    font-weight: 500;
    color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
}

.form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1rem;
}

.submit-trade-btn,
.cancel-trade-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.submit-trade-btn {
    background-color: #FFD700;
    color: #000;
    border: none;
}

.submit-trade-btn:hover {
    background-color: #F4C430;
    transform: translateY(-1px);
}

.cancel-trade-btn {
    background-color: transparent;
    color: #666;
    border: 1px solid #ddd;
}

.cancel-trade-btn:hover {
    background-color: #f5f5f5;
}

@media (max-width: 768px) {
    .form-row {
        flex-direction: column;
        gap: 1rem;
    }
    
    .trade-modal {
        width: 95%;
    }
}`;

// Add the styles to the page
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = tradeModalStyles;
    document.head.appendChild(style);
}); 
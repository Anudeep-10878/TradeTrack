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
                        updateDashboardMetrics(updatedUser.metrics);
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

// Function to update dashboard metrics
function updateDashboardMetrics(metrics) {
    // Update total profit/loss
    const profitLossElement = document.querySelector('.profit .value');
    const profitLossChange = document.querySelector('.profit .change');
    profitLossElement.textContent = `₹${metrics.total_profit_loss.toFixed(2)}`;
    profitLossChange.textContent = `${metrics.total_trades} trades`;
    
    // Update total trades
    const tradesElement = document.querySelector('.trades .value');
    const tradesChange = document.querySelector('.trades .change');
    tradesElement.textContent = metrics.total_trades.toString();
    tradesChange.textContent = metrics.current_win_streak > 0 ? 
        `${metrics.current_win_streak} trade win streak` : 'No current streak';
    
    // Update win rate
    const winRateElement = document.querySelector('.win-rate .value');
    const winRateChange = document.querySelector('.win-rate .change');
    winRateElement.textContent = `${metrics.win_rate.toFixed(1)}%`;
    winRateChange.textContent = `Best: ${metrics.win_streak} trades`;
    
    // Update average return
    const avgReturnElement = document.querySelector('.avg-return .value');
    const avgReturnChange = document.querySelector('.avg-return .change');
    avgReturnElement.textContent = `₹${metrics.average_return.toFixed(2)}`;
    avgReturnChange.textContent = `Best: ₹${metrics.best_trade.toFixed(2)}`;

    // Update performance summary
    updatePerformanceSummary(metrics);
}

// Function to update performance summary
function updatePerformanceSummary(metrics) {
    const summaryItems = {
        'Monthly P&L': `₹${metrics.total_profit_loss.toFixed(2)}`,
        'Best Trade': `₹${metrics.best_trade.toFixed(2)}`,
        'Win Streak': `${metrics.win_streak} trades`,
        'Avg Hold Time': 'Calculating...'
    };

    const summaryGrid = document.querySelector('.summary-grid');
    if (summaryGrid) {
        summaryGrid.innerHTML = Object.entries(summaryItems).map(([label, value]) => `
            <div class="summary-item">
                <h4>${label}</h4>
                <p>${value}</p>
            </div>
        `).join('');
    }
}

// Function to update recent trades list
function updateRecentTrades(trades) {
    const tradesList = document.querySelector('.trades-list');
    if (!tradesList) return;

    if (!trades || trades.length === 0) {
        tradesList.innerHTML = `
            <div class="no-trades-message">
                <p>No trades recorded yet. Click "Add Trade" to get started.</p>
            </div>
        `;
        return;
    }

    // Get the most recent 5 trades
    const recentTrades = trades.slice(-5).reverse();
    
    tradesList.innerHTML = recentTrades.map(trade => `
        <div class="trade-item ${trade.profit_loss >= 0 ? 'profit' : 'loss'}">
            <div class="trade-info">
                <h4>${trade.positionName}</h4>
                <p class="trade-time">${new Date(trade.date).toLocaleDateString()}</p>
            </div>
            <div class="trade-result">
                <p class="${trade.profit_loss >= 0 ? 'profit' : 'loss'}">
                    ${trade.profit_loss >= 0 ? '+' : ''}₹${trade.profit_loss.toFixed(2)}
                </p>
                <span class="percentage">
                    ${((trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100).toFixed(1)}%
                </span>
            </div>
        </div>
    `).join('');
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
        <h2>Select Position Type</h2>
        <div class="position-type-selector">
            <div class="position-buttons">
                <button type="button" class="position-btn" data-type="naked">
                    <i class="fas fa-user"></i>
                    Naked Position
                </button>
                <button type="button" class="position-btn" data-type="strategy">
                    <i class="fas fa-chess"></i>
                    Strategies
                </button>
            </div>
        </div>
    </div>
</div>`;

const nakedPositionModalHTML = `
<div id="nakedPositionModal" class="modal">
    <div class="modal-content trade-modal">
        <span class="close-modal">&times;</span>
        <h2>Add Naked Position</h2>
        <form id="nakedPositionForm" class="trade-form">
            <div class="form-group">
                <label for="tradeDate">Date</label>
                <input type="date" id="tradeDate" name="date" required>
            </div>
            <div class="form-group">
                <label for="positionName">Position Name</label>
                <input type="text" id="positionName" name="positionName" required placeholder="e.g., NIFTY 19400 CE">
            </div>
            <div class="form-group">
                <label for="quantity">Total Quantity</label>
                <input type="number" id="quantity" name="quantity" required min="1" placeholder="Enter quantity">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="entryPrice">Entry Price</label>
                    <input type="number" id="entryPrice" name="entryPrice" required step="0.01" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label for="exitPrice">Exit Price</label>
                    <input type="number" id="exitPrice" name="exitPrice" required step="0.01" placeholder="0.00">
                </div>
            </div>
            <div class="form-group">
                <label for="entryReason">Entry Reason</label>
                <textarea id="entryReason" name="entryReason" rows="3" placeholder="Explain your reason for entering this position..."></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="cancel-trade-btn">Cancel</button>
                <button type="submit" class="submit-trade-btn">Add Position</button>
            </div>
        </form>
    </div>
</div>`;

// Add the modals to the page when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    // Add trade modal to body
    document.body.insertAdjacentHTML('beforeend', addTradeModalHTML);
    document.body.insertAdjacentHTML('beforeend', nakedPositionModalHTML);
    
    // Add Trade button click handler
    const addTradeBtn = document.querySelector('.add-trade-btn');
    const addTradeModal = document.getElementById('addTradeModal');
    const nakedPositionModal = document.getElementById('nakedPositionModal');
    const closeModals = document.querySelectorAll('.close-modal');
    const cancelBtns = document.querySelectorAll('.cancel-trade-btn');
    const nakedPositionForm = document.getElementById('nakedPositionForm');

    // Set today's date as default
    const tradeDateInput = document.getElementById('tradeDate');
    const today = new Date().toISOString().split('T')[0];
    tradeDateInput.value = today;
    tradeDateInput.max = today; // Prevent future dates

    // Position type buttons handler
    const positionBtns = addTradeModal.querySelectorAll('.position-btn');
    positionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            positionBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            const selectedType = btn.dataset.type;
            if (selectedType === 'naked') {
                hideAddTradeModal();
                showNakedPositionModal();
            } else if (selectedType === 'strategy') {
                // Handle strategy selection (to be implemented)
                console.log('Strategy selected');
            }
        });
    });

    function showAddTradeModal() {
        addTradeModal.style.display = 'flex';
        setTimeout(() => addTradeModal.classList.add('show'), 10);
    }

    function hideAddTradeModal() {
        addTradeModal.classList.remove('show');
        setTimeout(() => {
            addTradeModal.style.display = 'none';
        }, 300);
    }

    function showNakedPositionModal() {
        nakedPositionModal.style.display = 'flex';
        setTimeout(() => nakedPositionModal.classList.add('show'), 10);
    }

    function hideNakedPositionModal() {
        nakedPositionModal.classList.remove('show');
        setTimeout(() => {
            nakedPositionModal.style.display = 'none';
            nakedPositionForm.reset();
            tradeDateInput.value = today; // Reset date to today
        }, 300);
    }

    // Show modal when Add Trade button is clicked
    addTradeBtn.addEventListener('click', showAddTradeModal);

    // Hide modals when close button is clicked
    closeModals.forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            hideAddTradeModal();
            hideNakedPositionModal();
        });
    });

    // Hide modals when cancel button is clicked
    cancelBtns.forEach(cancelBtn => {
        cancelBtn.addEventListener('click', () => {
            hideAddTradeModal();
            hideNakedPositionModal();
        });
    });

    // Hide modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === addTradeModal) {
            hideAddTradeModal();
        }
        if (e.target === nakedPositionModal) {
            hideNakedPositionModal();
        }
    });

    // Function to submit trade data
    async function submitTrade(tradeData) {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !user.email) {
                throw new Error('User not authenticated');
            }

            const response = await fetch(`${API_URL}/api/trade/${user.email}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(tradeData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save trade');
            }

            // Update dashboard with new data
            updateDashboardMetrics(data.metrics);
            updateRecentTrades(data.trades);

            // Show success notification
            showNotification('Trade saved successfully!', 'success');
            
            // Close the modal
            const nakedPositionModal = document.getElementById('nakedPositionModal');
            if (nakedPositionModal) {
                nakedPositionModal.style.display = 'none';
            }

            return true;
        } catch (error) {
            console.error('Error submitting trade:', error);
            showNotification(error.message || 'Failed to save trade. Please try again.', 'error');
            return false;
        }
    }

    // Event listener for naked position form submission
    document.addEventListener('submit', async function(e) {
        if (e.target.matches('#nakedPositionForm')) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const tradeData = {
                date: formData.get('date'),
                positionName: formData.get('positionName'),
                quantity: Number(formData.get('quantity')),
                entryPrice: Number(formData.get('entryPrice')),
                exitPrice: Number(formData.get('exitPrice')),
                entryReason: formData.get('entryReason'),
                type: 'naked'
            };

            // Validate the form data
            if (!tradeData.positionName || !tradeData.quantity || !tradeData.entryPrice || !tradeData.exitPrice) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            // Submit the trade
            const success = await submitTrade(tradeData);
            
            if (success) {
                // Reset the form
                e.target.reset();
            }
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

// Function to show notifications
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Trigger reflow to enable animation
    notification.offsetHeight;
    
    // Show notification
    notification.classList.add('show');
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
} 
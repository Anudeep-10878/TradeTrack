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

// API URL Configuration
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isDevelopment ? 'http://localhost:3000' : 'https://tradetrack-58el.onrender.com';

console.log('Current environment:', isDevelopment ? 'Development' : 'Production');
console.log('Using API URL:', API_URL);

async function saveUserToDatabase(googleUser) {
    try {
        console.log('Making request to:', `${API_URL}/api/user`);
        
        // First try to check if the server is reachable
        try {
            const statusResponse = await fetch(`${API_URL}/status`);
            const statusData = await statusResponse.json();
            console.log('Server status:', statusData);
            
            if (!statusData || statusData.mongodb === 'disconnected') {
                throw new Error('Server is not ready. Please try again in a few moments.');
            }
        } catch (statusError) {
            console.error('Status check error:', statusError);
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
    try {
        console.log('Fetching user data for:', email);
        console.log('API URL:', API_URL);
        
        // First check if server is reachable
        try {
            const statusResponse = await fetch(`${API_URL}/`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                mode: 'cors'
            });
            
            if (!statusResponse.ok) {
                throw new Error('Server is not responding');
            }
            
            const statusData = await statusResponse.json();
            console.log('Server status:', statusData);
        } catch (statusError) {
            console.error('Server status check failed:', statusError);
            throw new Error('Cannot connect to server. Please try again later.');
        }
        
        // Now fetch user data
        const response = await fetch(`${API_URL}/api/user/${email}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to fetch user data: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('User data received:', data);
        return data;
    } catch (error) {
        console.error('Error in getUserData:', error);
        throw error;
    }
}

// Function to get default metrics
function getDefaultMetrics() {
    return {
        total_profit_loss: 0,
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        average_return: 0,
        best_trade: 0,
        worst_trade: 0,
        win_streak: 0,
        current_win_streak: 0
    };
}

// Function to ensure numeric values in metrics
function sanitizeMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') {
        console.warn('Invalid metrics object, using defaults');
        return getDefaultMetrics();
    }
    
    const defaultMetrics = getDefaultMetrics();
    const sanitized = {};
    
    // Ensure all metrics exist and are numbers
    Object.keys(defaultMetrics).forEach(key => {
        let value = metrics[key];
        if (value === null || value === undefined || isNaN(Number(value))) {
            console.warn(`Invalid value for metric ${key}, using default`);
            sanitized[key] = defaultMetrics[key];
        } else {
            sanitized[key] = Number(value);
        }
    });
    
    return sanitized;
}

// Function to update dashboard metrics
function updateDashboardMetrics(metrics = null) {
    try {
        // Ensure metrics are properly sanitized
        const sanitizedMetrics = sanitizeMetrics(metrics);
        console.log('Sanitized metrics:', sanitizedMetrics);
        
        // Update total profit/loss
        const profitLossElement = document.querySelector('.profit .value');
        const profitLossChange = document.querySelector('.profit .change');
        if (profitLossElement && profitLossChange) {
            const totalPL = sanitizedMetrics.total_profit_loss;
            profitLossElement.textContent = `₹${totalPL.toFixed(2)}`;
            profitLossChange.textContent = `${sanitizedMetrics.total_trades} trades`;
        }
        
        // Update total trades
        const tradesElement = document.querySelector('.trades .value');
        const tradesChange = document.querySelector('.trades .change');
        if (tradesElement && tradesChange) {
            tradesElement.textContent = sanitizedMetrics.total_trades.toString();
            const winStreak = sanitizedMetrics.current_win_streak;
            tradesChange.textContent = winStreak > 0 ? 
                `${winStreak} trade win streak` : 'No current streak';
        }
        
        // Update win rate
        const winRateElement = document.querySelector('.win-rate .value');
        const winRateChange = document.querySelector('.win-rate .change');
        if (winRateElement && winRateChange) {
            const winRate = sanitizedMetrics.win_rate;
            const totalWinning = sanitizedMetrics.winning_trades;
            const totalLosing = sanitizedMetrics.losing_trades;
            winRateElement.textContent = `${winRate.toFixed(1)}%`;
            winRateChange.textContent = `${totalWinning}W - ${totalLosing}L`;
        }
        
        // Update average return
        const avgReturnElement = document.querySelector('.avg-return .value');
        const avgReturnChange = document.querySelector('.avg-return .change');
        if (avgReturnElement && avgReturnChange) {
            const avgReturn = sanitizedMetrics.average_return;
            const bestTrade = sanitizedMetrics.best_trade;
            avgReturnElement.textContent = `₹${avgReturn.toFixed(2)}`;
            avgReturnChange.textContent = `Best: ₹${bestTrade.toFixed(2)}`;
        }

        // Update performance summary
        updatePerformanceSummary(sanitizedMetrics);

    } catch (error) {
        console.error('Error updating dashboard metrics:', error);
        showNotification('Error updating dashboard. Please refresh the page.', 'error');
    }
}

// Function to update performance summary
function updatePerformanceSummary(metrics = getDefaultMetrics()) {
    try {
        metrics = sanitizeMetrics(metrics);
        
        const summaryItems = {
            'Monthly P&L': `₹${metrics.total_profit_loss.toFixed(2)}`,
            'Best Trade': `₹${metrics.best_trade.toFixed(2)}`,
            'Win Streak': `${metrics.win_streak} trades`
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
    } catch (error) {
        console.error('Error updating performance summary:', error);
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

    // Get the most recent 3 trades
    const recentTrades = trades.slice(-3).reverse();
    
    tradesList.innerHTML = recentTrades.map(trade => `
        <div class="trade-item ${trade.profit_loss >= 0 ? 'profit' : 'loss'}">
            <div class="trade-info">
                <h4>${trade.positionName}</h4>
                <p class="trade-time">${new Date(trade.date).toLocaleDateString()}</p>
            </div>
            <div class="trade-result">
                <p class="${trade.profit_loss >= 0 ? 'profit' : 'loss'}">
                    ${trade.profit_loss >= 0 ? '+₹' : '-₹'}${Math.abs(trade.profit_loss).toFixed(2)}
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

            // Validate trade data
            if (!tradeData.positionName || !tradeData.quantity || !tradeData.entryPrice || !tradeData.exitPrice) {
                throw new Error('Please fill in all required fields');
            }

            // Ensure numeric values
            tradeData.quantity = Number(tradeData.quantity);
            tradeData.entryPrice = Number(tradeData.entryPrice);
            tradeData.exitPrice = Number(tradeData.exitPrice);

            if (isNaN(tradeData.quantity) || isNaN(tradeData.entryPrice) || isNaN(tradeData.exitPrice)) {
                throw new Error('Invalid numeric values for quantity or prices');
            }

            if (tradeData.quantity <= 0) {
                throw new Error('Quantity must be greater than 0');
            }

            if (tradeData.entryPrice <= 0 || tradeData.exitPrice <= 0) {
                throw new Error('Prices must be greater than 0');
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
            if (data.metrics) {
                updateDashboardMetrics(data.metrics);
            }
            if (data.trades) {
                updateRecentTrades(data.trades);
            }

            // Show success notification
            showNotification('Trade saved successfully!', 'success');
            
            // Close the modal
            hideNakedPositionModal();

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

// Check authentication status
function checkAuth() {
    const user = localStorage.getItem('user');
    
    // Get the current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (!user) {
        console.log('No user data found in localStorage');
        if (currentPage !== 'index.html') {
            console.log('Redirecting to login page');
            window.location.replace('index.html');
        }
        return false;
    }

    try {
        // Parse user data to verify it's valid JSON
        const userData = JSON.parse(user);
        console.log('Parsed user data:', userData);

        if (!userData.email) {
            console.error('Invalid user data - no email found');
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
                    console.log('Received updated user data:', updatedUser);
                    if (updatedUser) {
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        updateDashboardMetrics(updatedUser.metrics);
                        if (updatedUser.trades) {
                            updateRecentTrades(updatedUser.trades);
                        }
                    }
                })
                .catch(error => {
                    console.error('Error fetching user data from server:', error);
                    showNotification('Could not fetch latest data from server. Please check your internet connection and try again.', 'error');
                });
        }
        
        return true;
    } catch (error) {
        console.error('Error in checkAuth:', error);
        localStorage.removeItem('user');
        if (currentPage !== 'index.html') {
            window.location.replace('index.html');
        }
        return false;
    }
}

// View Management
function showView(viewId) {
    const views = ['dashboard-view', 'library-view'];
    views.forEach(view => {
        document.getElementById(view).style.display = view === viewId ? 'block' : 'none';
    });

    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(link => {
        if (link.dataset.view === viewId.replace('-view', '')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    if (viewId === 'library-view') {
        loadLibraryTrades();
    }
}

// Initialize view navigation
document.querySelectorAll('.nav-links a[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        showView(`${e.target.closest('a').dataset.view}-view`);
    });
});

// Library Functions
async function loadLibraryTrades() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.email) {
            throw new Error('User not authenticated');
        }

        const response = await fetch(`${API_URL}/api/trades/${user.email}`);
        if (!response.ok) throw new Error('Failed to fetch trades');
        
        const trades = await response.json();
        displayLibraryTrades(trades);
    } catch (error) {
        console.error('Error loading trades:', error);
        showNotification('Failed to load trades', 'error');
    }
}

function displayLibraryTrades(trades) {
    const tbody = document.getElementById('library-trades');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (!trades || trades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-trades">No trades recorded yet.</td>
            </tr>
        `;
        return;
    }

    // Sort trades by date in descending order (most recent first)
    const sortedTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedTrades.forEach(trade => {
        const row = document.createElement('tr');
        const profitLoss = calculatePL(trade.entryPrice, trade.exitPrice, trade.quantity);
        const isProfit = profitLoss >= 0;
        const tradeId = trade._id ? trade._id.toString() : '';
        
        row.innerHTML = `
            <td>${new Date(trade.date).toLocaleDateString()}</td>
            <td>
                <div class="trade-name">
                    <span class="trade-title">${trade.name || ''}</span>
                    ${trade.positionName ? `<span class="position-name">${trade.positionName}</span>` : ''}
                </div>
            </td>
            <td>${trade.quantity}</td>
            <td>₹${parseFloat(trade.entryPrice).toFixed(2)}</td>
            <td>₹${parseFloat(trade.exitPrice).toFixed(2)}</td>
            <td class="${isProfit ? 'profit' : 'loss'}">${isProfit ? '+' : '-'}₹${Math.abs(profitLoss).toFixed(2)}</td>
            <td>
                <button onclick="editTrade('${tradeId}')" class="edit-btn" data-trade-id="${tradeId}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deleteTrade('${tradeId}')" class="delete-btn" data-trade-id="${tradeId}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function calculatePL(entryPrice, exitPrice, quantity) {
    return (exitPrice - entryPrice) * quantity;
}

async function editTrade(tradeId) {
    try {
        if (!tradeId) {
            throw new Error('Invalid trade ID');
        }

        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.email) {
            throw new Error('User not authenticated');
        }

        // Show loading state
        showNotification('Loading trade data...', 'info');

        // First try to find the trade in the existing trades array
        const trades = user.trades || [];
        const localTrade = trades.find(t => t._id && t._id.toString() === tradeId);

        if (localTrade) {
            // If found locally, use that data
            populateEditModal(localTrade);
        } else {
            // If not found locally, fetch from server
            const response = await fetch(`${API_URL}/api/trade/${user.email}/${tradeId}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch trade data');
            }

            const trade = await response.json();
            if (!trade) {
                throw new Error('Trade not found');
            }

            populateEditModal(trade);
        }

    } catch (error) {
        console.error('Error in editTrade:', error);
        showNotification(error.message || 'Failed to load trade data', 'error');
    }
}

function populateEditModal(trade) {
    // Populate modal with trade data
    document.getElementById('editTradeId').value = trade._id;
    document.getElementById('editTradeName').value = trade.positionName || trade.name || '';
    document.getElementById('editTradeDate').value = new Date(trade.date).toISOString().split('T')[0];
    document.getElementById('editQuantity').value = trade.quantity;
    document.getElementById('editEntryPrice').value = parseFloat(trade.entryPrice).toFixed(2);
    document.getElementById('editExitPrice').value = parseFloat(trade.exitPrice).toFixed(2);

    // Show modal
    const modal = document.getElementById('editTradeModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);

    // Set max date to today
    document.getElementById('editTradeDate').max = new Date().toISOString().split('T')[0];
}

// Handle edit trade form submission
document.getElementById('editTradeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.email) {
            throw new Error('User not authenticated');
        }

        const tradeId = document.getElementById('editTradeId').value;
        const tradeData = {
            positionName: document.getElementById('editTradeName').value,
            date: document.getElementById('editTradeDate').value,
            quantity: parseInt(document.getElementById('editQuantity').value),
            entryPrice: parseFloat(document.getElementById('editEntryPrice').value),
            exitPrice: parseFloat(document.getElementById('editExitPrice').value)
        };

        // Validate the data
        if (!tradeData.positionName || !tradeData.quantity || !tradeData.entryPrice || !tradeData.exitPrice) {
            throw new Error('Please fill in all required fields');
        }

        if (tradeData.quantity <= 0) {
            throw new Error('Quantity must be greater than 0');
        }

        if (tradeData.entryPrice <= 0 || tradeData.exitPrice <= 0) {
            throw new Error('Prices must be greater than 0');
        }

        // Show loading state
        showNotification('Updating trade...', 'info');

        const response = await fetch(`${API_URL}/api/trade/${user.email}/${tradeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tradeData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update trade');
        }

        // Close modal
        const modal = document.getElementById('editTradeModal');
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);

        // Refresh trades display
        await loadLibraryTrades();
        showNotification('Trade updated successfully', 'success');

    } catch (error) {
        console.error('Error updating trade:', error);
        showNotification(error.message || 'Failed to update trade', 'error');
    }
});

async function deleteTrade(tradeId) {
    if (!confirm('Are you sure you want to delete this trade?')) {
        return;
    }

    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.email) {
            throw new Error('User not authenticated');
        }

        const response = await fetch(`${API_URL}/api/trade/${user.email}/${tradeId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete trade');
        }

        // Refresh trades display
        await loadLibraryTrades();
        showNotification('Trade deleted successfully');

    } catch (error) {
        console.error('Error deleting trade:', error);
        showNotification('Failed to delete trade', 'error');
    }
}

// Close modal when clicking the close button or outside
document.querySelectorAll('.close-modal').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    });
});

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
        setTimeout(() => e.target.style.display = 'none', 300);
    }
}); 
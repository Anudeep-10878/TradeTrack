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
                const offset = 20; // Adjust this value for desired spacing
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
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
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
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
            
            // Log the update for debugging
            console.log('Updated profile:', { name: displayName, picture: user.picture });
        } else {
            console.error('Profile elements not found in DOM');
        }
    } else {
        console.error('No user data found in localStorage');
    }
}

// Function to decode JWT token
function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// Google OAuth Configuration
function handleCredentialResponse(response) {
    console.log('Google Sign-In response received');
    try {
        const credential = response.credential;
        console.log('Decoding JWT token');
        const decoded = jwt_decode(credential);
        console.log('Successfully decoded token:', decoded);
        
        // Save user data to localStorage immediately
        localStorage.setItem('user', JSON.stringify(decoded));
        console.log('User data saved to localStorage');
        
        // Redirect to dashboard immediately
        console.log('Redirecting to dashboard...');
        window.location.replace('dashboard.html');
        
        // After redirect, try to save user data to server
        fetch(`${API_URL}/status`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Cannot connect to server');
                }
                return response.json();
            })
            .then(status => {
                if (!status || status.mongodb === 'disconnected') {
                    throw new Error('Server unavailable');
                }
                return saveUserToDatabase(decoded);
            })
            .then(user => {
                if (user) {
                    // Update localStorage with server response
                    localStorage.setItem('user', JSON.stringify(user));
                }
            })
            .catch(error => {
                console.error('Error saving to server:', error);
                // User is already redirected, no need to handle error here
            });
    } catch (error) {
        console.error('Error in handleCredentialResponse:', error);
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
            window.location.replace('index.html');
        }
        return false;
    } else {
        // If user exists and we're on index page, redirect to dashboard
        if (currentPage === 'index.html') {
            window.location.replace('dashboard.html');
            return false;
        }
        
        // Update dashboard if we're on the dashboard page
        if (currentPage === 'dashboard.html') {
            const userData = JSON.parse(user);
            
            // First update UI with local data
            updateUserProfile();
            
            // Then try to get updated data from server
            getUserData(userData.email)
                .then(updatedUser => {
                    if (updatedUser) {
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        updateDashboardMetrics(updatedUser);
                        updateRecentTrades(updatedUser.trades);
                        updateUserProfile();
                    }
                })
                .catch(error => {
                    console.error('Error fetching user data:', error);
                    // Don't logout on server error, just show what we have
                });
        }
        
        return true;
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
    const profileImageUpload = document.querySelector('.profile-image-upload');
    const profilePreview = document.getElementById('profilePreview');

    // Handle profile picture upload
    if (profileImageUpload) {
        profileImageUpload.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64Image = e.target.result;
                        profilePreview.src = base64Image;
                        
                        // Store the new image temporarily
                        localStorage.setItem('tempProfilePic', base64Image);
                    };
                    reader.readAsDataURL(file);
                }
            };
            
            input.click();
        });
    }

    // Open settings modal with corrected display style
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            const user = JSON.parse(localStorage.getItem('user'));
            if (user) {
                // Populate user data
                document.getElementById('profilePreview').src = user.picture || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
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

    // Save settings with profile picture
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                alert('Please log in to save settings');
                return;
            }

            const tradingCapital = document.getElementById('tradingCapital').value;
            const tradingExperience = document.getElementById('tradingExperience').value;
            const newProfilePic = localStorage.getItem('tempProfilePic');

            try {
                const response = await fetch(`${API_URL}/api/user/${user.email}/settings`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tradingCapital: tradingCapital ? Number(tradingCapital) : null,
                        tradingExperience: tradingExperience || null,
                        picture: newProfilePic || user.picture
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to save settings');
                }

                const updatedUser = await response.json();
                
                // Update local storage with new settings
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const updatedUserData = {
                    ...currentUser,
                    picture: newProfilePic || currentUser.picture,
                    tradingCapital: updatedUser.tradingCapital,
                    tradingExperience: updatedUser.tradingExperience
                };
                
                localStorage.setItem('user', JSON.stringify(updatedUserData));
                localStorage.removeItem('tempProfilePic'); // Clear temporary storage
                
                // Update the profile picture in the dashboard
                const dashboardProfilePic = document.querySelector('.profile-pic');
                if (dashboardProfilePic && newProfilePic) {
                    dashboardProfilePic.src = newProfilePic;
                }

                alert('Settings saved successfully!');
                settingsModal.classList.remove('show');
                setTimeout(() => {
                    settingsModal.style.display = 'none';
                }, 300);
            } catch (error) {
                console.error('Error saving settings:', error);
                alert('Failed to save settings. Please try again.');
            }
        });
    }

    // Close settings modal with animation
    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', () => {
            settingsModal.classList.remove('show');
            setTimeout(() => {
                settingsModal.style.display = 'none';
                localStorage.removeItem('tempProfilePic'); // Clear temporary storage when closing
            }, 300);
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('show');
            setTimeout(() => {
                settingsModal.style.display = 'none';
                localStorage.removeItem('tempProfilePic'); // Clear temporary storage when closing
            }, 300);
        }
    });
}); 
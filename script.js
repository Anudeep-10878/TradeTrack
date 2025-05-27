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
const modal = document.getElementById('loginModal');
const closeModal = document.querySelector('.close-modal');
const ctaButtons = document.querySelectorAll('.cta-button, .get-started-btn');

// Open modal when CTA buttons are clicked
ctaButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    });
});

// Close modal when clicking the close button
closeModal.addEventListener('click', () => {
    modal.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling
    }
});

// Function to update user profile in dashboard
function updateUserProfile() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        const username = document.querySelector('.username');
        const profilePic = document.querySelector('.profile-pic');
        
        if (username && profilePic) {
            // Update username - use given name if available, otherwise full name
            username.textContent = user.given_name || user.name;
            
            // Update profile picture
            if (user.picture) {
                profilePic.src = user.picture;
                profilePic.alt = user.name;
            }
        }
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
        
        // First check if server is connected to MongoDB
        console.log('Checking server status...');
        fetch(`${API_URL}/status`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Server status check failed');
                }
                return response.json();
            })
            .then(status => {
                console.log('Server status:', status);
                if (status.mongodb === 'disconnected') {
                    throw new Error('Database is currently unavailable. Please try again in a few minutes.');
                }
                
                // If connected, proceed with saving user
                console.log('Attempting to save user to database');
                return saveUserToDatabase(decoded);
            })
            .then(user => {
                console.log('User saved successfully:', user);
                localStorage.setItem('user', JSON.stringify(user));
                console.log('User data saved to localStorage');
                console.log('Redirecting to dashboard...');
                window.location.href = 'dashboard.html';
            })
            .catch(error => {
                console.error('Error in authentication flow:', error);
                alert(error.message || 'Failed to save user data. Please try again.');
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
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    } catch (error) {
        console.error('Error in saveUserToDatabase:', error);
        throw new Error(`Failed to save user: ${error.message}`);
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
            window.location.href = 'index.html';
        }
        return false;
    } else {
        // If user exists and we're on index page, redirect to dashboard
        if (currentPage === 'index.html') {
            window.location.href = 'dashboard.html';
            return false;
        }
        
        // Update dashboard if we're on the dashboard page
        if (currentPage === 'dashboard.html') {
            const userData = JSON.parse(user);
            getUserData(userData.email)
                .then(updatedUser => {
                    updateDashboardMetrics(updatedUser);
                    updateRecentTrades(updatedUser.trades);
                    updateUserProfile(); // Make sure profile is updated
                })
                .catch(error => {
                    console.error('Error fetching user data:', error);
                    handleLogout();
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
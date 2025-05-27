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

// Google Sign-In callback function
function handleCredentialResponse(response) {
    // Decode the credential response
    const responsePayload = decodeJwtResponse(response.credential);
    
    // Store user info in localStorage with all available details
    localStorage.setItem('user', JSON.stringify({
        name: responsePayload.name,
        given_name: responsePayload.given_name,
        email: responsePayload.email,
        picture: responsePayload.picture
    }));

    // Close modal
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    // Redirect to dashboard
    window.location.href = 'dashboard.html';
}

// Check authentication status on dashboard page
if (window.location.pathname.includes('dashboard.html')) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        // Redirect to home page if not authenticated
        window.location.href = 'index.html';
    } else {
        // Update dashboard UI with user info
        updateUserProfile();
    }
}

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

function handleLogout() {
    // Clear user data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Redirect to landing page
    window.location.href = 'index.html';
} 
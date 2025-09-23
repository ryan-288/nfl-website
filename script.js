// Global state
let currentUser = null;
let contacts = [];

// Navbar blur effect on scroll
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// API Configuration
const API_BASE = ''; // Adjust this to your PHP API path
const API_ENDPOINTS = {
    login: 'LAMPAPI/LoginAPIContactMgr.php',
    register: 'LAMPAPI/RegisterAPIConctactMgr.php',
    addContact: 'LAMPAPI/addContactsAPI.php',
    searchContacts: 'LAMPAPI/SearchAPIContactMgr.php',
    deleteContact: 'LAMPAPI/removeContactAPI.php',
    editContact: 'LAMPAPI/editContactAPI.php'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showContactSection();
    } else {
        showLogin();
    }

    // Set up form event listeners
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Registration form
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Contact form
    document.getElementById('contactForm').addEventListener('submit', handleAddContact);
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const loginData = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        showLoading(true);
        const response = await makeAPICall(API_ENDPOINTS.login, loginData);
        
        if (response.error) {
            showAlert('error', response.error);
        } else {
            currentUser = {
                id: response.id,
                firstName: response.firstName,
                lastName: response.lastName
            };
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showContactSection();
            showAlert('success', `Welcome back to the kingdom, ${response.firstName}!`);
        }
    } catch (error) {
        showAlert('error', 'Login failed. Please try again.');
        console.error('Login error:', error);
    } finally {
        showLoading(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const registerData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        showLoading(true);
        const response = await makeAPICall(API_ENDPOINTS.register, registerData);
        
        if (response.error) {
            showAlert('error', response.error);
        } else {
            currentUser = {
                id: response.id,
                firstName: response.firstName,
                lastName: response.lastName
            };
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showContactSection();
            showAlert('success', `Welcome to Knightro's Kingdom, ${response.firstName}! Your account has been created.`);
        }
    } catch (error) {
        showAlert('error', 'Registration failed. Please try again.');
        console.error('Registration error:', error);
    } finally {
        showLoading(false);
    }
}

// Contact Management Functions
async function handleAddContact(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const contactData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        userId: currentUser.id.toString()
    };

    try {
        showLoading(true);
        const response = await makeAPICall(API_ENDPOINTS.addContact, contactData);
        
        if (response.error) {
            if (response.error === '') {
                // Empty error means success
                showAlert('success', 'Contact added to the kingdom successfully!');
                e.target.reset();
                hideAddContactForm();
                // Refresh the contacts list
                await loadContacts();
            } else {
                showAlert('error', response.error);
            }
        } else {
            showAlert('success', 'Contact added to the kingdom successfully!');
            e.target.reset();
            hideAddContactForm();
            // Refresh the contacts list
            await loadContacts();
        }
    } catch (error) {
        showAlert('error', 'Failed to add contact. Please try again.');
        console.error('Add contact error:', error);
    } finally {
        showLoading(false);
    }
}

async function loadContacts() {
    if (!currentUser) return;

    try {
        showLoading(true);
        const response = await makeAPICall(API_ENDPOINTS.searchContacts, {
            userId: currentUser.id.toString(),
            search: '' // Empty search to get all contacts
        });
        
        if (response.error) {
            if (response.error === 'No Records Found') {
                contacts = [];
            } else {
                showAlert('error', response.error);
            }
        } else {
            contacts = response.results || [];
        }
        
        displayContacts();
    } catch (error) {
        showAlert('error', 'Failed to load contacts.');
        console.error('Load contacts error:', error);
    } finally {
        showLoading(false);
    }
}

// Silent version of loadContacts for use after delete/add operations
async function loadContactsSilently() {
    if (!currentUser) return;

    try {
        const response = await makeAPICall(API_ENDPOINTS.searchContacts, {
            userId: currentUser.id.toString(),
            search: '' // Empty search to get all contacts
        });
        
        if (response.error) {
            if (response.error === 'No Records Found') {
                contacts = [];
            } else {
                showAlert('error', response.error);
            }
        } else {
            contacts = response.results || [];
        }
        
        displayContacts();
    } catch (error) {
        showAlert('error', 'Failed to load contacts.');
        console.error('Load contacts error:', error);
    }
}

async function searchContacts() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    if (!currentUser) return;

    try {
        const response = await makeAPICall(API_ENDPOINTS.searchContacts, {
            userId: currentUser.id.toString(),
            search: searchTerm
        });
        
        if (response.error) {
            if (response.error === 'No Records Found') {
                contacts = [];
            } else {
                showAlert('error', response.error);
            }
        } else {
            contacts = response.results || [];
        }
        
        displayContacts();
    } catch (error) {
        showAlert('error', 'Search failed.');
        console.error('Search error:', error);
    }
}

// Delete contact function
async function deleteContact(contactId) {
    if (!currentUser) return;
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this contact?')) {
        return;
    }
    
    try {
        const response = await makeAPICall(API_ENDPOINTS.deleteContact, {
            userId: currentUser.id.toString(),
            contactId: contactId.toString()
        });
        
        if (response.error) {
            if (response.error === '') {
                // Empty error means success
                showAlert('success', 'Contact removed from the kingdom!');
                // Refresh the contacts list without loading spinner
                await loadContactsSilently();
            } else {
                showAlert('error', response.error);
            }
        } else {
            showAlert('success', 'Contact removed from the kingdom!');
            // Refresh the contacts list without loading spinner
            await loadContactsSilently();
        }
    } catch (error) {
        showAlert('error', 'Failed to delete contact.');
        console.error('Delete error:', error);
    }
}

function displayContacts() {
    const contactsList = document.getElementById('contactsList');
    const noContacts = document.getElementById('noContacts');
    
    if (contacts.length === 0) {
        contactsList.style.display = 'none';
        noContacts.style.display = 'block';
        return;
    }
    
    contactsList.style.display = 'block';
    noContacts.style.display = 'none';
    
    contactsList.innerHTML = contacts.map(contact => `
        <div class="contact-card">
            <div class="contact-info">
                <h4>${escapeHtml(contact.firstName)} ${escapeHtml(contact.lastName)}</h4>
                <div class="contact-details">
                    <div><i class="fas fa-phone"></i> ${escapeHtml(contact.phone)}</div>
                    <div><i class="fas fa-envelope"></i> ${escapeHtml(contact.email)}</div>
                </div>
            </div>
            <div class="contact-actions">
                <button class="btn btn-small btn-edit" onclick="editContact(${contact.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-small btn-delete" onclick="deleteContact(${contact.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// UI Functions
function showLogin() {
    hideAllSections();
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('loginNav').style.display = 'block';
    document.getElementById('registerNav').style.display = 'block';
    document.getElementById('userNav').style.display = 'none';
}

function showRegister() {
    hideAllSections();
    document.getElementById('registerSection').style.display = 'block';
    document.getElementById('loginNav').style.display = 'block';
    document.getElementById('registerNav').style.display = 'block';
    document.getElementById('userNav').style.display = 'none';
}

function showContactSection() {
    hideAllSections();
    document.getElementById('contactSection').style.display = 'block';
    document.getElementById('loginNav').style.display = 'none';
    document.getElementById('registerNav').style.display = 'none';
    document.getElementById('userNav').style.display = 'block';
    
    // Update user info in navigation
    document.getElementById('userInfo').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    
    // Load contacts
    loadContacts();
}

function hideAllSections() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('contactSection').style.display = 'none';
}

function showAddContactForm() {
    document.getElementById('addContactForm').style.display = 'block';
    document.getElementById('contactForm').reset();
}

function hideAddContactForm() {
    document.getElementById('addContactForm').style.display = 'none';
}

function logout() {
    currentUser = null;
    contacts = [];
    localStorage.removeItem('currentUser');
    showLogin();
    showAlert('info', 'You have left the kingdom.');
}

// Utility Functions
async function makeAPICall(endpoint, data) {
    const response = await fetch(API_BASE + endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const responseText = await response.text();
    console.log('Raw API response:', responseText);
    
    try {
        // Handle duplicate JSON responses (some APIs return multiple JSON objects)
        const cleanedResponse = responseText.replace(/}{/g, '},{');
        const jsonArray = JSON.parse('[' + cleanedResponse + ']');
        return jsonArray[0]; // Return the first (and usually only) response
    } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response text:', responseText);
        throw new Error(`Invalid JSON response: ${parseError.message}`);
    }
}

function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
}

function showAlert(type, message) {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    const alert = document.createElement('div');
    alert.id = alertId;
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${message}</span>
            <button onclick="closeAlert('${alertId}')" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; margin-left: 1rem; color: #FFD700;">&times;</button>
        </div>
    `;
    
    alertContainer.appendChild(alert);
    
    // Add touchdown effect for success messages
    if (type === 'success') {
        setTimeout(() => {
            alert.classList.add('touchdown-effect');
        }, 100);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        closeAlert(alertId);
    }, 5000);
}

function closeAlert(alertId) {
    const alert = document.getElementById(alertId);
    if (alert) {
        alert.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            alert.remove();
        }, 300);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Edit contact function - makes the card editable
function editContact(contactId) {
    const contact = contacts.find(c => c.id == contactId);
    if (!contact) {
        showAlert('error', 'Contact not found');
        return;
    }
    
    // Find the contact card
    const contactCards = document.querySelectorAll('.contact-card');
    let contactCard = null;
    for (let card of contactCards) {
        if (card.querySelector(`button[onclick="editContact(${contactId})"]`)) {
            contactCard = card;
            break;
        }
    }
    
    if (!contactCard) {
        showAlert('error', 'Contact card not found');
        return;
    }
    
    // Store original content
    contactCard.dataset.originalContent = contactCard.innerHTML;
    
    // Make card editable
    contactCard.innerHTML = `
        <div class="contact-info">
            <div class="form-group">
                <label class="edit-label">First Name:</label>
                <input type="text" id="editFirstName_${contactId}" value="${escapeHtml(contact.firstName)}" class="edit-input" required>
            </div>
            <div class="form-group">
                <label class="edit-label">Last Name:</label>
                <input type="text" id="editLastName_${contactId}" value="${escapeHtml(contact.lastName)}" class="edit-input" required>
            </div>
            <div class="form-group">
                <label class="edit-label">Phone:</label>
                <input type="tel" id="editPhone_${contactId}" value="${escapeHtml(contact.phone)}" class="edit-input" required>
            </div>
            <div class="form-group">
                <label class="edit-label">Email:</label>
                <input type="email" id="editEmail_${contactId}" value="${escapeHtml(contact.email)}" class="edit-input" required>
            </div>
        </div>
        <div class="contact-actions">
            <button class="btn btn-small btn-save" onclick="saveContact(${contactId})" title="Save Changes">
                <i class="fas fa-save"></i>
            </button>
            <button class="btn btn-small btn-cancel" onclick="cancelEdit(${contactId})" title="Cancel">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Focus on first input
    document.getElementById(`editFirstName_${contactId}`).focus();
}

async function saveContact(contactId) {
    if (!currentUser) return;
    
    const contactData = {
        contactId: contactId.toString(),
        userId: currentUser.id.toString(),
        firstName: document.getElementById(`editFirstName_${contactId}`).value,
        lastName: document.getElementById(`editLastName_${contactId}`).value,
        phone: document.getElementById(`editPhone_${contactId}`).value,
        email: document.getElementById(`editEmail_${contactId}`).value
    };
    
    // Validate required fields
    if (!contactData.firstName || !contactData.lastName || !contactData.phone || !contactData.email) {
        showAlert('error', 'All fields are required');
        return;
    }
    
    try {
        const response = await makeAPICall(API_ENDPOINTS.editContact, contactData);
        console.log('Edit API response:', response);
        
        if (response.error) {
            if (response.error === '') {
                // Empty error means success
                showAlert('success', 'Contact updated in the kingdom!');
                // Refresh the contacts list without loading spinner
                await loadContactsSilently();
            } else {
                showAlert('error', response.error);
            }
        } else {
            showAlert('success', 'Contact updated in the kingdom!');
            // Refresh the contacts list without loading spinner
            await loadContactsSilently();
        }
    } catch (error) {
        showAlert('error', 'Failed to update contact.');
        console.error('Update error:', error);
        console.error('Error details:', error.message);
    }
}

function cancelEdit(contactId) {
    // Find the contact card
    const contactCards = document.querySelectorAll('.contact-card');
    let contactCard = null;
    for (let card of contactCards) {
        if (card.querySelector(`button[onclick="saveContact(${contactId})"]`)) {
            contactCard = card;
            break;
        }
    }
    
    if (contactCard && contactCard.dataset.originalContent) {
        // Restore original content
        contactCard.innerHTML = contactCard.dataset.originalContent;
        delete contactCard.dataset.originalContent;
    } else {
        // Fallback: refresh the contacts list
        loadContactsSilently();
    }
}

// Add CSS for slideOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateY(0);
            opacity: 1;
        }
        to {
            transform: translateY(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);


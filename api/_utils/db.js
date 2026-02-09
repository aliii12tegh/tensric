/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Simple Database (Storage Utility)
   ═══════════════════════════════════════════════════════════════ */

// In production, use a real database like MongoDB, PostgreSQL, etc.
// This is a simple file-based storage for demo purposes

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), '.data');
const USERS_FILE = path.join(DB_PATH, 'users.json');
const IMAGES_FILE = path.join(DB_PATH, 'images.json');

// Initialize database
function initDb() {
    if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(DB_PATH, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, '[]');
    }
    if (!fs.existsSync(IMAGES_FILE)) {
        fs.writeFileSync(IMAGES_FILE, '[]');
    }
}

// Read data
function readData(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return [];
    }
}

// Write data
function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Users
function getUsers() {
    initDb();
    return readData(USERS_FILE);
}

function getUserById(id) {
    const users = getUsers();
    return users.find(u => u.id === id);
}

function getUserByEmail(email) {
    const users = getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function createUser(userData) {
    initDb();
    const users = getUsers();
    const newUser = {
        id: generateId(),
        ...userData,
        credits: 50,
        plan: 'free',
        createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeData(USERS_FILE, users);
    return newUser;
}

function updateUser(id, updates) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;

    users[index] = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
    writeData(USERS_FILE, users);
    return users[index];
}

// Images
function getImages(userId) {
    initDb();
    const images = readData(IMAGES_FILE);
    return images.filter(i => i.userId === userId);
}

function createImage(imageData) {
    initDb();
    const images = readData(IMAGES_FILE);
    const newImage = {
        id: generateId(),
        ...imageData,
        createdAt: new Date().toISOString()
    };
    images.push(newImage);
    writeData(IMAGES_FILE, images);
    return newImage;
}

// Helper
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

module.exports = {
    getUsers,
    getUserById,
    getUserByEmail,
    createUser,
    updateUser,
    getImages,
    createImage
};

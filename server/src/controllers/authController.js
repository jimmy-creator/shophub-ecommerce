import { User } from '../models/index.js';
import { generateToken } from '../middleware/auth.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ message: 'Password must contain uppercase, lowercase, and a number' });
    }

    if (name.length > 100 || email.length > 254) {
      return res.status(400).json({ message: 'Input too long' });
    }

    const existingUser = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Force role to 'customer' — never trust client input for role
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'customer',
    });

    const token = generateToken(user.id);
    res.cookie('token', token, cookieOptions);

    // Send token in body for localStorage (needed for API calls from frontend)
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user.id);
    res.cookie('token', token, cookieOptions);

    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
};

export const logout = (req, res) => {
  res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
  res.json({ message: 'Logged out' });
};

export const getProfile = async (req, res) => {
  res.json(req.user);
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    await req.user.update({ name, phone, address });
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

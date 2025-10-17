import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d"; // 7 days default


// Force type assertions for JWT
const jwtSecret = JWT_SECRET as jwt.Secret;
const jwtExpiry = JWT_EXPIRY as string;

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: 'admin';
  };
  token: string;
}

/**
 * Login existing user
 */
export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const { email, password } = input;

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  // Find user in DB
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.isActive || user.role !== 'admin') {
    throw new Error("Invalid email or password");
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new Error("Invalid email or password");
  }

  // Generate JWT token
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, {
    expiresIn: jwtExpiry,
  } as jwt.SignOptions);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token,
  };
};

/**
 * Verify JWT token and return user data
 */
export const verifyToken = async (token: string) => {
  try {
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      role?: string;
    };

    // Look up user in DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        role: true,
      },
    });

    if (!user || !user.isActive || user.role !== 'admin') {
      throw new Error('Invalid or inactive user');
    }

    return user;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

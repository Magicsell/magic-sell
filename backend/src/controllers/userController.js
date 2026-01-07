import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { requireRole } from "../middleware/auth.js";

/**
 * GET /api/users
 * Get all users (admin only)
 * Query params: role, isApproved, isActive, page, pageSize
 */
export async function getUsers(req, res) {
  try {
    const { role, isApproved, isActive, page = 1, pageSize = 20 } = req.query;
    const organizationId = req.organizationId;

    // Build query
    const query = { organizationId };

    if (role) {
      query.role = role;
    }

    if (isApproved !== undefined) {
      query.isApproved = isApproved === "true" || isApproved === true;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true" || isActive === true;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    // Get users
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
}

/**
 * GET /api/users/:id
 * Get user by ID (admin only)
 */
export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;

    const user = await User.findOne({
      _id: id,
      organizationId,
    })
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
}

/**
 * PATCH /api/users/:id/approve
 * Approve user (admin only)
 */
export async function approveUser(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;

    const user = await User.findOne({
      _id: id,
      organizationId,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only approve customer and driver roles
    if (user.role !== "customer" && user.role !== "driver") {
      return res.status(400).json({ error: "Only customer and driver users can be approved" });
    }

    user.isApproved = true;
    await user.save();

    res.json({
      success: true,
      message: "User approved successfully",
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({ error: "Failed to approve user" });
  }
}

/**
 * PATCH /api/users/:id/reject
 * Reject user (admin only) - sets isActive to false
 */
export async function rejectUser(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;

    const user = await User.findOne({
      _id: id,
      organizationId,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.isActive = false;
    user.isApproved = false;
    await user.save();

    res.json({
      success: true,
      message: "User rejected successfully",
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({ error: "Failed to reject user" });
  }
}

/**
 * PATCH /api/users/:id
 * Update user (admin only)
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;
    const updateData = { ...req.body };

    console.log("[updateUser] Request params:", { id, organizationId });
    console.log("[updateUser] Update data:", JSON.stringify(updateData, null, 2));

    // Don't allow updating role or organizationId directly
    delete updateData.role;
    delete updateData.organizationId;

    // Handle password update separately if provided
    // Password will be hashed by pre('save') hook in User model
    const user = await User.findOne({ _id: id, organizationId });
    
    if (!user) {
      console.log("[updateUser] User not found:", { id, organizationId });
      return res.status(404).json({ error: "User not found" });
    }

    console.log("[updateUser] Found user:", { 
      _id: user._id, 
      email: user.email, 
      role: user.role,
      hasCustomerProfile: !!user.customerProfile 
    });

    // Update fields
    Object.keys(updateData).forEach((key) => {
      if (key === "customerProfile" || key === "driverProfile") {
        // Ensure the profile object exists before merging
        if (!user[key]) {
          user[key] = {};
        }
        
        // Preserve existing geo field before merge (if it exists and is valid)
        const existingGeo = (user[key]?.geo && 
                             typeof user[key].geo.lat === 'number' && 
                             typeof user[key].geo.lng === 'number') 
                             ? { lat: user[key].geo.lat, lng: user[key].geo.lng } 
                             : undefined;
        
        // Get the profile update data
        const profileUpdate = updateData[key] || {};
        
        // Clean up undefined values and remove geo from update
        const cleanedUpdate = {};
        Object.keys(profileUpdate).forEach((profileKey) => {
          // Skip geo field completely - we'll preserve existing
          if (profileKey === "geo") {
            return;
          }
          // Only include defined values
          if (profileUpdate[profileKey] !== undefined) {
            cleanedUpdate[profileKey] = profileUpdate[profileKey];
          }
        });
        
        // Update each field individually to avoid overwriting geo
        Object.keys(cleanedUpdate).forEach((profileKey) => {
          user[key][profileKey] = cleanedUpdate[profileKey];
        });
        
        // Restore geo field if it existed before (don't touch it if it didn't exist)
        // Use markModified to tell Mongoose that this nested object was modified
        if (existingGeo !== undefined && existingGeo !== null) {
          user[key].geo = existingGeo;
          user.markModified(`${key}.geo`);
        }
        
        // Mark the entire profile as modified
        user.markModified(key);
        
        console.log(`[updateUser] Updated ${key}:`, user[key]);
        console.log(`[updateUser] Preserved geo:`, existingGeo);
      } else if (key !== "password") {
        // Don't update password here, it will be handled by pre-save hook
        if (updateData[key] !== undefined) {
          user[key] = updateData[key];
          console.log(`[updateUser] Updated ${key}:`, user[key]);
        }
      }
    });

    // Handle password update separately if provided
    if (updateData.password) {
      user.password = updateData.password;
      console.log("[updateUser] Password will be hashed by pre-save hook");
    }

    // Validate before saving
    const validationError = user.validateSync();
    if (validationError) {
      console.error("[updateUser] Validation error:", validationError);
      const errors = Object.keys(validationError.errors).map(
        (key) => validationError.errors[key].message
      );
      return res.status(400).json({ 
        error: "Validation failed", 
        details: errors 
      });
    }

    await user.save();
    console.log("[updateUser] User saved successfully");

    // Return updated user without password
    const updatedUser = await User.findById(user._id).select("-password");

    res.json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[updateUser] Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    
    // Handle specific MongoDB errors
    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map(
        (key) => error.errors[key].message
      );
      return res.status(400).json({ 
        error: "Validation failed", 
        details: errors 
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: "Email already exists in this organization" 
      });
    }
    
    res.status(500).json({ 
      error: "Failed to update user",
      message: error.message || "Unknown error occurred"
    });
  }
}

/**
 * POST /api/users
 * Create user (admin only)
 */
export async function createUser(req, res) {
  try {
    const organizationId = req.organizationId;
    const { email, password, role, customerProfile, driverProfile, isApproved } = req.body;

    // Validation
    if (!email || !password || !role) {
      return res.status(400).json({ error: "Email, password, and role are required" });
    }

    if (!["customer", "driver"].includes(role)) {
      return res.status(400).json({ error: "Role must be customer or driver" });
    }

    // Email format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Email kontrolü (aynı organization içinde unique)
    const existingUser = await User.findOne({
      organizationId,
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // User oluştur
    const userData = {
      organizationId,
      email: email.toLowerCase(),
      password,
      role,
      isActive: true,
      isApproved: isApproved !== undefined ? isApproved : true, // Admin-created users are auto-approved by default
    };

    if (role === "customer" && customerProfile) {
      userData.customerProfile = customerProfile;
    }

    if (role === "driver" && driverProfile) {
      userData.driverProfile = driverProfile;
    }

    const user = await User.create(userData);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already registered" });
    }
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
}

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;

    const user = await User.findOneAndDelete({
      _id: id,
      organizationId,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
}

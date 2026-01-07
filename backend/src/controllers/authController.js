import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { Notification } from "../models/Notification.js";
import { generateToken } from "../middleware/auth.js";

/**
 * Password validation
 */
function validatePassword(password) {
  if (!password || password.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters" };
  }
  return { valid: true };
}

/**
 * POST /api/auth/register
 * Organization + Admin user oluştur
 */
export async function register(req, res) {
  try {
    const { organizationName, email, password, adminName } = req.body;

    // Validation
    if (!organizationName || !email || !password) {
      return res.status(400).json({ error: "Organization name, email, and password are required" });
    }

    // Password validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Email format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Slug oluştur (organization name'den)
    const slug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Organization oluştur
    const organization = await Organization.create({
      name: organizationName,
      slug: slug,
      subscriptionPlan: "free",
      subscriptionStatus: "active",
      settings: {
        timezone: "Europe/London",
        currency: "GBP",
        depotLocation: {
          lat: 50.707088,
          lng: -1.922318,
          postcode: "BH13 7EX",
        },
        deliveryRadius: 50,
      },
    });

    // Admin user oluştur
    const adminUser = await User.create({
      organizationId: organization._id,
      email: email.toLowerCase(),
      password: password,
      role: "admin",
      isActive: true,
    });

    // Token oluştur
    const token = generateToken(adminUser);

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: adminUser._id,
        email: adminUser.email,
        role: adminUser.role,
        organizationId: adminUser.organizationId,
      },
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      if (error.keyPattern?.slug) {
        return res.status(400).json({ error: "Organization name already taken" });
      }
      if (error.keyPattern?.["organizationId_1_email_1"]) {
        return res.status(400).json({ error: "Email already registered in this organization" });
      }
    }
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
}

/**
 * POST /api/auth/login
 * Email + password ile login
 */
export async function login(req, res) {
  try {
    const { email, password, organizationSlug } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Organization bul (eğer slug verilmişse)
    let organization = null;
    if (organizationSlug) {
      organization = await Organization.findOne({ slug: organizationSlug, isActive: true });
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
    }

    // User bul
    const query = { email: email.toLowerCase(), isActive: true };
    if (organization) {
      query.organizationId = organization._id;
    }
    
    const user = await User.findOne(query);
    
    if (!user) {
      // Rate limit kaydı (user bulunamadı - başarısız deneme)
      if (req.rateLimitRecord) {
        req.rateLimitRecord();
      }
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Password kontrolü
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Rate limit kaydı (yanlış password - başarısız deneme)
      if (req.rateLimitRecord) {
        req.rateLimitRecord();
      }
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Customer ve driver için admin onayı kontrolü
    if ((user.role === "customer" || user.role === "driver") && !user.isApproved) {
      return res.status(403).json({ 
        error: "Your account is pending approval. Please wait for admin approval." 
      });
    }

    // Başarılı login - rate limit temizle
    if (req.rateLimitClear) {
      req.rateLimitClear();
    }

    // Organization bilgisini çek (eğer yoksa)
    if (!organization) {
      organization = await Organization.findById(user.organizationId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
    }

    // Last login güncelle
    user.lastLoginAt = new Date();
    await user.save();

    // Token oluştur
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
}

/**
 * POST /api/auth/register-customer
 * Customer registration (public endpoint)
 */
export async function registerCustomer(req, res) {
  try {
    const { organizationName, organizationSlug, email, password, customerProfile, name, phone, address, postcode, city } = req.body;

    // Validation
    if ((!organizationName && !organizationSlug) || !email || !password) {
      return res.status(400).json({ error: "Organization name/slug, email, and password are required" });
    }

    // Password validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Email format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Organization bul (slug veya name ile)
    let organization = null;
    if (organizationSlug) {
      console.log(`[registerCustomer] Looking for organization with slug: "${organizationSlug}"`);
      organization = await Organization.findOne({ slug: organizationSlug, isActive: true });
      if (!organization) {
        // Debug: Tüm organization'ları listele
        const allOrgs = await Organization.find({ isActive: true }).select("name slug").lean();
        console.log(`[registerCustomer] Available organizations:`, allOrgs);
        return res.status(404).json({ 
          error: `Organization with slug "${organizationSlug}" not found. Please contact your administrator.`,
          availableOrganizations: allOrgs.map(org => ({ name: org.name, slug: org.slug }))
        });
      }
    } else if (organizationName) {
      console.log(`[registerCustomer] Looking for organization with name: "${organizationName}"`);
      organization = await Organization.findOne({ name: organizationName, isActive: true });
      if (!organization) {
        return res.status(404).json({ error: `Organization "${organizationName}" not found. Please contact your administrator.` });
      }
    } else {
      return res.status(400).json({ error: "Organization slug or name is required" });
    }
    
    console.log(`[registerCustomer] Found organization: ${organization.name} (${organization.slug})`);

    // Customer profile oluştur (eğer direkt customerProfile gelmediyse, form'dan gelen alanları kullan)
    const profile = customerProfile || {};
    if (name && !profile.name) profile.name = name;
    if (phone && !profile.phone) profile.phone = phone;
    if (address && !profile.address) profile.address = address;
    if (postcode && !profile.postcode) profile.postcode = postcode;
    if (city && !profile.city) profile.city = city;

    // Check if email already exists in this organization
    const existingUser = await User.findOne({
      organizationId: organization._id,
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered in this organization" });
    }

    // Customer user oluştur (isApproved: false - admin onayı bekliyor)
    const customerUser = await User.create({
      organizationId: organization._id,
      email: email.toLowerCase(),
      password: password,
      role: "customer",
      customerProfile: profile,
      isActive: true,
      isApproved: false, // Admin onayı bekliyor
    });

    // Admin'lere notification gönder
    const admins = await User.find({
      organizationId: organization._id,
      role: "admin",
      isActive: true,
    });

    // Her admin için notification oluştur
    const notifications = admins.map((admin) => ({
      organizationId: organization._id,
      userId: admin._id,
      type: "user_pending_approval",
      title: "New Customer Registration",
      message: `${customerUser.email} has registered and is waiting for approval.`,
      relatedId: customerUser._id,
      relatedType: "user",
      isRead: false,
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({
      success: true,
      message: "Registration successful. Your account is pending admin approval.",
      user: {
        _id: customerUser._id,
        email: customerUser.email,
        role: customerUser.role,
        isApproved: customerUser.isApproved,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      if (error.keyPattern?.["organizationId_1_email_1"]) {
        return res.status(400).json({ error: "Email already registered in this organization" });
      }
    }
    console.error("Register customer error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
}

/**
 * GET /api/auth/organizations
 * Public endpoint - Aktif organization'ları listele (register için)
 */
export async function getOrganizations(req, res) {
  try {
    const organizations = await Organization.find({ isActive: true })
      .select("name slug")
      .sort({ name: 1 })
      .lean();

    res.json({
      organizations: organizations.map(org => ({
        name: org.name,
        slug: org.slug,
      })),
    });
  } catch (error) {
    console.error("Get organizations error:", error);
    res.status(500).json({ error: "Failed to get organizations" });
  }
}

/**
 * GET /api/auth/me
 * Mevcut user bilgisini döndür
 */
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("organizationId", "name slug")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        customerProfile: user.customerProfile,
        driverProfile: user.driverProfile,
        isActive: user.isActive,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
}


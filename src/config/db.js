import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

let host = process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST || '127.0.0.1';
let port = parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || process.env.MYSQLPORT || '3306', 10);
let user = process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQLUSER || 'root';
let password = process.env.DB_PASSWORD || process.env.DB_PASS || process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || '';
let database = process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || 'nexxskill_db';

const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.JAWSDB_URL;
if (dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    host = parsed.hostname || host;
    port = parseInt(parsed.port || String(port), 10);
    user = decodeURIComponent(parsed.username || user);
    password = decodeURIComponent(parsed.password || password);
    database = (parsed.pathname || '').replace(/^\//, '') || database;
  } catch (_) {}
}

const dbConfig = {
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  charset: 'utf8mb4'
};

export const pool = mysql.createPool(dbConfig);

// Helper function to execute queries safely
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Auto-initialize tables and columns
export async function initDatabase() {
  try {
    // 1. Check server connection (without database first in case it's not created)
    const initConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await initConn.end();

    // 2. Create tables
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('student','admin') NOT NULL DEFAULT 'student',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(220) NOT NULL UNIQUE,
        description TEXT,
        bullets JSON,
        price_paise INT NOT NULL DEFAULT 0,
        duration VARCHAR(100),
        type ENUM('available','upcoming') NOT NULL DEFAULT 'available',
        thumbnail_url VARCHAR(500),
        video_url VARCHAR(1000) DEFAULT NULL,
        videos LONGTEXT DEFAULT NULL,
        enable_player TINYINT(1) NOT NULL DEFAULT 1,
        is_published TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        course_id INT NOT NULL,
        razorpay_order_id VARCHAR(100),
        razorpay_payment_id VARCHAR(100),
        razorpay_signature VARCHAR(255),
        amount_paise INT NOT NULL,
        coupon_code VARCHAR(50) DEFAULT NULL,
        discount_amount_paise INT DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        status ENUM('created','paid','failed','refunded') NOT NULL DEFAULT 'created',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        discount_percent INT NOT NULL DEFAULT 10,
        usage_type ENUM('single','multiple') NOT NULL DEFAULT 'multiple',
        max_uses INT DEFAULT 0,
        used_count INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        email VARCHAR(150) NOT NULL,
        course_interested VARCHAR(150),
        experience_level ENUM('Beginner','Intermediate','Advanced'),
        status ENUM('new','contacted','converted') NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(150) NOT NULL,
        subject VARCHAR(200),
        message TEXT NOT NULL,
        status ENUM('unresolved','resolved') NOT NULL DEFAULT 'unresolved',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS webinars (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        type ENUM('live','recording') NOT NULL,
        meeting_url VARCHAR(500),
        scheduled_at DATETIME,
        available_dates JSON,
        quota INT NOT NULL DEFAULT 50,
        registrations_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS webinar_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        webinar_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        selected_date VARCHAR(100),
        question TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (webinar_id) REFERENCES webinars(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        question VARCHAR(300) NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR(100),
        sort_order INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure columns exist in case tables were created with earlier schema versions
    try {
      await query(`ALTER TABLE coupons ADD COLUMN used_count INT NOT NULL DEFAULT 0 AFTER max_uses`);
    } catch (_) {}

    try {
      await query(`ALTER TABLE courses ADD COLUMN video_url VARCHAR(1000) NULL AFTER thumbnail_url`);
    } catch (_) {}

    try {
      await query(`ALTER TABLE courses ADD COLUMN videos LONGTEXT NULL AFTER video_url`);
    } catch (_) {}

    try {
      await query(`ALTER TABLE courses ADD COLUMN enable_player TINYINT(1) NOT NULL DEFAULT 1 AFTER videos`);
    } catch (_) {}

    try {
      await query(`ALTER TABLE webinar_registrations ADD COLUMN reminder_sent TINYINT(1) NOT NULL DEFAULT 0 AFTER question`);
    } catch (_) {}

    // Auto-seed default admin if no users exist
    const users = await query(`SELECT id FROM users LIMIT 1`);
    if (users.length === 0) {
      const adminPassHash = await bcrypt.hash('admin123', 10);
      const studentPassHash = await bcrypt.hash('student123', 10);

      await query(
        `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`,
        ['Jahangir Alom Bakul', 'admin@nexxskill.com', '+916002860802', adminPassHash]
      );

      await query(
        `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'student')`,
        ['Ananya Roy', 'student@nexxskill.com', '+919876543210', studentPassHash]
      );

      // Seed default courses
      const defaultCourses = [
        ['Mainframe Full Course', 'mainframe-full-course', 'Comprehensive 2-month training program covering IBM System z Mainframe ecosystem from ground up.', JSON.stringify(["COBOL Programming","JCL & VSAM Datasets","DB2 & CICS Integration","Hands-on Lab Access"]), 799900, '2 Months', 'available', 1],
        ['Mainframe Crash Course', 'mainframe-crash-course', 'Intensive 25-hour bootcamp covering critical Mainframe operations and enterprise workflows.', JSON.stringify(["Core COBOL Syntax","JCL Job Execution","VSAM File Structures","Debugging Techniques"]), 249900, '25 Hours', 'available', 1],
        ['Interview Preparation', 'interview-preparation', 'Master real-world Mainframe interview scenarios, mock technical rounds, and resume building.', JSON.stringify(["100+ Enterprise Q&A","Mock Technical Interviews","Resume Optimization","Placement Guidance"]), 249900, '25 Hours', 'available', 1],
        ['Corporate Communication', 'corporate-communication', 'Essential business communication and soft skills training tailored for tech professionals in corporate environments.', JSON.stringify(["Professional Email Etiquette","Stakeholder Interaction","Interview Confidence","Presentation Skills"]), 149900, '12 Hours', 'available', 1],
        ['Daily AI Usage in Work', 'daily-ai-usage-in-work', 'Boost workplace productivity using modern AI tools, prompt engineering, and workflow automation.', JSON.stringify(["AI Tools Mastery","Prompt Engineering","Automating Routine Tasks","Case Studies"]), 0, 'Upcoming', 'upcoming', 1],
        ['Career Growth Program', 'career-growth-program', 'Strategic guidance for engineers aiming for rapid career progression and senior tech roles.', JSON.stringify(["Career Mapping","Leadership Fundamentals","Tech Architecture Transition","Mentorship"]), 0, 'Upcoming', 'upcoming', 1],
        ['Resume Building Program', 'resume-building-program', 'High-impact resume crafting and LinkedIn profiling for high-paying enterprise engineering jobs.', JSON.stringify(["ATS-Friendly Resumes","LinkedIn Profile Optimization","Portfolio Building","Industry Formatting"]), 0, 'Upcoming', 'upcoming', 1],
        ['Full Stack Development', 'full-stack-development', 'End-to-end full stack web development program with modern frontend frameworks and API architectures.', JSON.stringify(["React & Node.js","Database Design","REST API Architecture","Cloud Deployment"]), 0, 'Upcoming', 'upcoming', 1],
        ['AI and ML Program', 'ai-and-ml-program', 'Comprehensive Machine Learning and Artificial Intelligence curriculum for aspiring data specialists.', JSON.stringify(["Python Data Stack","Scikit-Learn & PyTorch","Model Deployment","Real-world Projects"]), 0, 'Upcoming', 'upcoming', 1],
        ['Data Analytics Full Program', 'data-analytics-full-program', 'Master SQL, Tableau, PowerBI, and Python for data-driven enterprise business intelligence.', JSON.stringify(["SQL & Data Warehousing","Tableau & Power BI","Business Analytics","Excel Advanced Techniques"]), 0, 'Upcoming', 'upcoming', 1],
        ['Data Science Full Program', 'data-science-full-program', 'End-to-end Data Science specialization covering predictive modeling, statistics, and big data.', JSON.stringify(["Statistical Modeling","Machine Learning Pipeline","Big Data Fundamentals","Industry Capstone"]), 0, 'Upcoming', 'upcoming', 1]
      ];

      for (const c of defaultCourses) {
        await query(
          `INSERT IGNORE INTO courses (title, slug, description, bullets, price_paise, duration, type, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          c
        );
      }

      // Seed FAQs
      const defaultFaqs = [
        ['What background knowledge is required for the Mainframe Full Course?', 'No prior Mainframe experience is necessary. Basic programming fundamentals are helpful, but we start from core principles.', 'General', 1],
        ['Are live interactive classes provided or pre-recorded sessions?', 'We offer live interactive classes led by industry veterans from IBM and Societe Generale, along with recorded session access for revisions.', 'Classes', 2],
        ['How does the placement support and interview prep work?', 'Our Interview Preparation module includes resume refinement, mock technical interviews, and direct referral opportunities with partner enterprises.', 'Career Support', 3],
        ['What payment options are available?', 'We accept Credit/Debit cards, Net Banking, UPI, and major digital wallets securely through Razorpay.', 'Payments', 4]
      ];

      for (const f of defaultFaqs) {
        await query(
          `INSERT IGNORE INTO faqs (question, answer, category, sort_order) VALUES (?, ?, ?, ?)`,
          f
        );
      }

      // Seed Webinars
      await query(
        `INSERT IGNORE INTO webinars (title, description, type, meeting_url, scheduled_at, available_dates, quota, registrations_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Demystifying System z Mainframes in Modern Banking',
          'Join Jahangir Alom Bakul for an exclusive breakdown of enterprise infrastructure scaling in global banks.',
          'live',
          'https://meet.google.com/nexxskill-mainframe-demo',
          '2026-09-01 18:00:00',
          JSON.stringify(['2026-09-01 18:00 IST', '2026-09-05 18:00 IST', '2026-09-10 18:00 IST']),
          30,
          0
        ]
      );
    }

    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Database initialization warning:', error.message);
  }
}

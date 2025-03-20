import AdminService from '../services/admin.service.js';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';

class AdminController {
    constructor() {
        this.adminService = new AdminService();
        // Add OTP store
        this.otpStore = {};
        
        // Configure nodemailer transporter
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
        
    }

    async requestOTP(req, res) {
        try {
            const { email } = req.body;
            
            // Verify admin exists
            const adminRef = await this.adminService.admins.where('email', '==', email).get();
            if (adminRef.empty) {
                return res.status(404).json({ error: 'Admin not found' });
            }
            
            // Generate a 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Store OTP with expiration (10 minutes)
            this.otpStore[email] = {
                otp: otp,
                expiresAt: Date.now() + 10 * 60 * 1000
            };
            
            // Send email with OTP
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Password Reset OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2>Password Reset Request</h2>
                        <p>You requested to change your password. Use this OTP to verify your identity:</p>
                        <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                            ${otp}
                        </div>
                        <p>This OTP will expire in 10 minutes.</p>
                        <p>If you didn't request this password change, please ignore this email.</p>
                    </div>
                `
            };
            
            await this.transporter.sendMail(mailOptions);
            
            res.status(200).json({ message: 'OTP sent successfully' });
        } catch (error) {
            console.error('Request OTP error:', error);
            res.status(500).json({ error: 'Failed to send OTP' });
        }
    }
    
    async verifyOTP(req, res) {
        try {
            const { email, otp } = req.body;
            
            // Check if OTP exists and is valid
            if (!this.otpStore[email] || this.otpStore[email].otp !== otp) {
                return res.status(400).json({ error: 'Invalid OTP' });
            }
            
            // Check if OTP has expired
            if (Date.now() > this.otpStore[email].expiresAt) {
                delete this.otpStore[email];
                return res.status(400).json({ error: 'OTP has expired' });
            }
            
            res.status(200).json({ message: 'OTP verified successfully' });
        } catch (error) {
            console.error('Verify OTP error:', error);
            res.status(500).json({ error: 'Failed to verify OTP' });
        }
    }
    
    async changePassword(req, res) {
        try {
            const { email, otp, newPassword } = req.body;
            
            // Verify OTP again
            if (!this.otpStore[email] || this.otpStore[email].otp !== otp) {
                return res.status(400).json({ error: 'Invalid OTP' });
            }
            
            // Check if OTP has expired
            if (Date.now() > this.otpStore[email].expiresAt) {
                delete this.otpStore[email];
                return res.status(400).json({ error: 'OTP has expired' });
            }
            
            // Hash the new password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            
            // Get admin document
            const adminRef = await this.adminService.admins.where('email', '==', email).get();
            const adminDoc = adminRef.docs[0];
            
            // Update the password
            await adminDoc.ref.update({
                password: hashedPassword
            });
            
            // Clear the OTP
            delete this.otpStore[email];
            
            res.status(200).json({ message: 'Password changed successfully' });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ error: 'Failed to change password' });
        }
    }
    
    async sendOTPEmail(email, otp) {
        // Configure your email service
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p>You requested to change your password. Please use the following OTP to verify your identity:</p>
                    <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This OTP will expire in 10 minutes.</p>
                    <p>If you didn't request this password change, please ignore this email or contact support.</p>
                    <p style="margin-top: 30px; font-size: 12px; color: #777;">
                        This is an automated email, please do not reply.
                    </p>
                </div>
            `
        };
        
        return transporter.sendMail(mailOptions);
    }

    async login(req, res) {
        try {
            const result = await this.adminService.login(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getAllUsers(req, res) {
        try {
            const users = await this.adminService.getAllUsers();
            res.status(200).json(users);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async updateUser(req, res) {
        try {
            const result = await this.adminService.updateUser(req.params.userId, req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteUser(req, res) {
        try {
            const result = await this.adminService.deleteUser(req.params.userId);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getFormSteps(req, res) {
        try {
            const forms = await this.adminService.getFormSteps();
            res.status(200).json(forms);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async editFormSteps(req, res) {
        try {
            const result = await this.adminService.editFormSteps(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getLists(req, res) {
        try {
            const lists = await this.adminService.getLists();
            res.status(200).json(lists);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async editLists(req, res) {
        try {
            const result = await this.adminService.editLists(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteLists(req, res) {
        try {
            const result = await this.adminService.deleteLists(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getList(req, res) {
        try {
            const list = await this.adminService.getList(req.params.listId);
            res.status(200).json(list);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async editList(req, res) {
        try {
            const listId = req.params.listId;
            const requestData = req.body;
            
            console.log('Editing list:', listId);
            console.log('Request data:', requestData);
            
            const result = await this.adminService.editList(listId, requestData);
            res.status(200).json(result);
        } catch (error) {
            console.error('Controller error editing list:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async deleteList(req, res) {
        try {
            const result = await this.adminService.deleteList(req.params.listId);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getUser(req, res) {
        try {
            const user = await this.adminService.getUser(req.params.userId);
            res.status(200).json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async searchUser(req, res) {
        try {
            const users = await this.adminService.searchUser(req.body);
            res.status(200).json(users);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async addList(req, res) {
        try {
            const list = await this.adminService.addList(req.body);
            res.status(201).json(list);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async searchColleges(req, res) {
        try {
            const colleges = await this.adminService.searchColleges(req.query);
            res.status(200).json(colleges);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getUserLists(req, res) {
        try {
            const userId = req.params.userId;
            console.log('Getting lists for user:', userId);
            
            const userLists = await this.adminService.getUserLists(userId);
            res.status(200).json(userLists);
        } catch (error) {
            console.error('Controller error getting user lists:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async createUserList(req, res) {
        try {
            console.log('Create user list request for user:', req.params.userId);
            console.log('Request body:', req.body);
            
            if (!req.body.colleges || !Array.isArray(req.body.colleges)) {
                return res.status(400).json({ error: 'Invalid colleges data - must be an array' });
            }
            
            const userList = await this.adminService.createUserList(req.params.userId, req.body);
            res.status(201).json(userList);
        } catch (error) {
            console.error('Controller error creating user list:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async updateUserList(req, res) {
        try {
            console.log('Update user list request for user:', req.params.userId);
            console.log('List ID:', req.params.listId);
            console.log('Request body:', req.body);
            
            if (!req.body.colleges || !Array.isArray(req.body.colleges)) {
                return res.status(400).json({ error: 'Invalid colleges data - must be an array' });
            }
            
            const userList = await this.adminService.updateUserList(req.params.userId, req.params.listId, req.body);
            res.status(200).json(userList);
        } catch (error) {
            console.error('Controller error updating user list:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async deleteUserList(req, res) {
        try {
            const result = await this.adminService.deleteUserList(req.params.userId, req.params.listId);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async assignListToUser(req, res) {
        try {
            const { userId } = req.params;
            const listAssignment = req.body;
            
            const result = await this.adminService.assignListToUser(userId, listAssignment);
            res.status(200).json(result);
        } catch (error) {
            console.error('Error assigning list to user:', error);
            res.status(400).json({ error: error.message });
        }
    }
}

// Create instance of controller
const adminController = new AdminController();

// Export controller methods individually
export default {
    login: adminController.login.bind(adminController),
    getAllUsers: adminController.getAllUsers.bind(adminController),
    updateUser: adminController.updateUser.bind(adminController),
    deleteUser: adminController.deleteUser.bind(adminController),
    getFormSteps: adminController.getFormSteps.bind(adminController),
    editFormSteps: adminController.editFormSteps.bind(adminController),
    getLists: adminController.getLists.bind(adminController),
    editLists: adminController.editLists.bind(adminController),
    deleteLists: adminController.deleteLists.bind(adminController),
    getList: adminController.getList.bind(adminController),
    editList: adminController.editList.bind(adminController),
    deleteList: adminController.deleteList.bind(adminController),
    getUser: adminController.getUser.bind(adminController),
    searchUser: adminController.searchUser.bind(adminController),
    requestOTP: adminController.requestOTP.bind(adminController),
    verifyOTP: adminController.verifyOTP.bind(adminController),
    changePassword: adminController.changePassword.bind(adminController),
    sendOTPEmail: adminController.sendOTPEmail.bind(adminController),
    addList: adminController.addList.bind(adminController),
    searchColleges: adminController.searchColleges.bind(adminController),
    getUserLists: adminController.getUserLists.bind(adminController),
    createUserList: adminController.createUserList.bind(adminController),
    updateUserList: adminController.updateUserList.bind(adminController),
    deleteUserList: adminController.deleteUserList.bind(adminController),
    assignListToUser: adminController.assignListToUser.bind(adminController),
};


import UserService from '../services/user.service.js';

class UserController {
  // Create new user
  async createUser(req, res) {
    try {
      const { name, phone } = req.body;
      if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
      }
      
      const user = await UserService.createUser({ name, phone });
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Get user by ID
  async getUserById(req, res) {
    try {
      const user = await UserService.getUserById(req.params.id);
      res.status(200).json(user);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  // Get user by phone
  async getUserByPhone(req, res) {
    try {
      const user = await UserService.getUserByPhone(req.params.phone);
      res.status(200).json(user);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  // Update premium plan
  async updatePremiumPlan(req, res) {
    try {
      const { planTitle, expiryDate, registrationData } = req.body;
      if (!planTitle || !expiryDate) {
        return res.status(400).json({ error: 'Plan title and expiry date are required' });
      }

      const user = await UserService.updatePremiumPlan(req.params.id, {
        planTitle,
        expiryDate: new Date(expiryDate),
        registrationData
      });
      res.status(200).json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Check premium status
  async checkPremiumStatus(req, res) {
    try {
      const user = await UserService.checkPremiumStatus(req.params.id);
      res.status(200).json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  // Check premium status
  async checkPremiumStatusByPhone(req, res) {
    try {
      const user = await UserService.checkPremiumStatusByPhone(req.body.phone);
      res.status(200).json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async sendOTP(req, res) {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
      
      const requiresOTP = await UserService.sendOTPForPremiumLogin(phone);
      res.status(200).json({ 
        otpSent: requiresOTP,
        message: requiresOTP ? 
          'OTP sent successfully' : 
          'Regular login - No OTP required'
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Login
  async login(req, res) {
    try {
      const { phone, password } = req.body;
      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
      
      const user = await UserService.login(phone, password);
      res.status(200).json(user);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  async logout(req, res) {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      await UserService.logout(userId);
      res.status(200).json({ message: 'User logged out successfully' });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }


  
  async getUserFormData(req, res) {
    try {
      const userId = req.user.id;
      const user = await UserService.getUserFormData(userId);
      res.status(200).json(user);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  async getFormSteps(req, res) {
    try {
      const formName = req.params.formName;
      
      const data = await UserService.getFormSteps(formName);
      res.status(200).json(data);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }
}

export default new UserController();
import { db } from '../../config/firebase.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

class UserService {
  constructor() {
    this.collection = db.collection('users');
    this.formCollection = db.collection('counsellingForms');
  }
  async createUser(userData) {
    try {
      const user = {
        name: userData.name,
        phone: userData.phone,
        isPremium: false,
        createdAt: new Date(),
        premiumPlan: null,
        hasLoggedIn: true
      };
      const snapshot = await this.collection.where('phone', '==', user.phone).get();
      if (!snapshot.empty) {
        throw new Error('User With this phone number already exists');
      }
      const docRef = await this.collection.add(user);
      return { id: docRef.id, ...user };
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  async sendOTPForPremiumLogin(phone) {
    try {
      const snapshot = await this.collection
        .where("phone", "==", phone.toString())
        .get();
        
      if (snapshot.empty) {
        throw new Error('User not found');
      }
      
      const doc = snapshot.docs[0];
      const userData = doc.data();
      
      if (userData.isPremium) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date();
        otpExpiry.setMinutes(otpExpiry.getMinutes() + 5);
        
        await this.collection.doc(doc.id).update({
          otp,
          otpExpiry
        });
        
        // TODO: Implement actual SMS service
        console.log(`SMS to ${phone}: Your verification code is: ${otp}`);
        
        return true;
      }
      return false;
    } catch (error) {
      throw new Error(`Error sending OTP: ${error.message}`);
    }
  }
  
  async login(phone, password = null) {
    try {
      const snapshot = await this.collection
        .where("phone", "==", phone.toString())
        .get();
        
      if (snapshot.empty) {
        throw new Error('User not found');
      }
      
      const doc = snapshot.docs[0];
      const userData = doc.data();
      
      if (userData.isPremium) {
        if (!password) {
          throw new Error('Password required for premium users');
        }
        const passMatch = await bcrypt.compare(password, userData.password);
        if(!passMatch) {
          throw new Error('Invalid password');
        }
        await this.collection.doc(doc.id).update({
          hasLoggedIn: true
        });
      } else {
        if (userData.hasLoggedIn) {
          throw new Error('User already logged in on another device');
        }
        
        await this.collection.doc(doc.id).update({
          hasLoggedIn: true
        });
      }

      const token = jwt.sign({ id: doc.id, phone: phone }, process.env.USER_JWT, {
        expiresIn: '1h'
      });

      return { id: doc.id, ...userData, token };
    } catch (error) {
      throw new Error(`Error during login: ${error.message}`);
    }
  }

  async logout(userId) {
    try {
      await this.collection.doc(userId).update({
        hasLoggedIn: false
      });
    } catch (error) {
      throw new Error(`Error during logout: ${error.message}`);
    }
  }
  
  async getUserById(id) {
    try {
      const doc = await this.collection.doc(id).get();
      if (!doc.exists) {
        throw new Error('User not found');
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Error getting user: ${error.message}`);
    }
  }
  async getUserByPhone(phone) {
    try {
      const snapshot = await this.collection.where('phone', '==', phone).get();
      if (snapshot.empty) {
        throw new Error('User not found');
      }
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Error getting user: ${error.message}`);
    }
  }
  async updatePremiumPlan(userId, planData) {
    try {
      const premiumPlan = {
        planTitle: planData.planTitle,
        purchasedDate: new Date(),
        expiryDate: planData.expiryDate,
      };

      const password = planData.registrationData.confirmPassword;
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      planData.registrationData.password = hashedPassword;
      planData.registrationData.confirmPassword = null;

      await this.collection.doc(userId).update({
        isPremium: true,
        premiumPlan,
        counsellingData: planData.registrationData,
        password: hashedPassword
      });

      return this.getUserById(userId);
    } catch (error) {
      throw new Error(`Error updating premium plan: ${error.message}`);
    }
  }
  async checkPremiumStatus(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user.premiumPlan) return user;
    
      const now = new Date();
      const expiryDate = user.premiumPlan.expiryDate.toDate();

      if (expiryDate < now) {
        await this.collection.doc(userId).update({
          isPremium: false
        });
        return this.getUserById(userId);
      }

      return user;
    } catch (error) {
      throw new Error(`Error checking premium status: ${error.message}`);
    }
  }
  async checkPremiumStatusByPhone(phone) {
    try {
      const user = await this.getUserByPhone(phone);
      if (!user.premiumPlan) return {
        isPremium: false
      };

      const now = new Date();
      const expiryDate = user.premiumPlan.expiryDate.toDate();

      

      if (expiryDate < now) {
        await this.collection.doc(user.id).update({
          isPremium: false
        });
        return {
          isPremium: false
        };
      }

      return {
        isPremium: true
      };
    } catch (error) {
      throw new Error(`Error checking premium status: ${error.message}`);
    }
  }

  async getFormSteps(formName) {
    try {
      let formSteps = null;
      
      const snapshot = await this.formCollection.where('id', '==', formName).get();

      if (snapshot.empty) {
        throw new Error('Form not found');
      }
      snapshot.forEach(doc => {
        formSteps = doc.data();
      });
         
      return formSteps;
    } catch (error) {
      throw new Error(`Error getting form steps: ${error.message}`);
    }
  }

  async getUserFormData(phone) {
    try {
      const user = await this.getUserByPhone(phone);
      if (!user.formStepData) {
        throw new Error('User has not filled any form');
      }
      return user.formStepData;
    } catch (error) {
      throw new Error(`Error checking premium status: ${error.message}`);
    }
  }
}

export default new UserService();
import mongoose from 'mongoose';

// Collection: admins
export const AdminsSchema = new mongoose.Schema({
  "id": String,
  "email": String,
  "password": String,
  "role": String,
  "permissions": {
    "pages": [String]
  },
  "createdAt": String,
  "updatedAt": String
});

// Collection: appointments
export const AppointmentsSchema = new mongoose.Schema({
  "id": String,
  "name": String,
  "phone": String,
  "reason": String,
  "createdAt": Date
});

// Collection: cancellations
export const CancellationsSchema = new mongoose.Schema({
  "id": String,
  "reason": String,
  "plan": String,
  "amount": Number,
  "orderId": String,
  "userId": String,
  "userPhone": String,
  "name": String,
  "createdAt": Date,
  "phone": String
});

// Collection: college_updates
export const College_updatesSchema = new mongoose.Schema({
  "id": String,
  "deleted": Boolean,
  "date": Date,
  "title": String,
  "subtitle": String,
  "type": String,
  "link": String,
  "thumbnail": String
});


// Collection: colleges_v4
export const Colleges_v4Schema = new mongoose.Schema({
  "id": String,
  "instituteCode": Number,
  "instituteName": String,
  "city": String,
  "keywords": [String],
  "branches": {
    "0": {
      "branchCode": String,
      "branchName": String,
      "branchShort": String,
      "cutoffs": {
        "0": {
          "category": String,
          "percentile": Number,
          "rank": Number,
          "capRound": String,
          "year": Number
        }
      }
    }
  },
  "additionalMetadata": {
    "status": String,
    "totalIntake": Number,
    "autonomyStatus": String,
    "minorityStatus": String,
    "address": String,
    "region": String,
    "university": String
  },
  "searchIndex": {
    "instituteCodeName": String,
    "instituteCodeCity": String,
    "instituteCityName": String
  }
});

// Collection: counsellingForms
export const CounsellingFormsSchema = new mongoose.Schema({
  "id": String,
  "lastUpdatedBy": String,
  "steps": {
    "0": {
      "number": Number,
      "title": String,
      "description": String,
      "showListButton": Boolean,
      "isLocked": Boolean,
      "premiumOnly": Boolean,
      "isCapSpecific": Boolean,
      "cap": Number,
      "isVerdict": Boolean,
      "isCapQuery": Boolean
    }
  },
  "updatedAt": String
});

// Collection: cutoffs_v2
export const Cutoffs_v2Schema = new mongoose.Schema({
  "id": String,
  "year": Number,
  "instituteCode": Number,
  "instituteName": String,
  "branchCode": String,
  "branchName": String,
  "Category": String,
  "capRound": String,
  "rank": Number,
  "percentile": Number,
  "Status": String,
  "searchIndex": {
    "yearRank": String,
    "yearPercentile": String,
    "branchCategory": String,
    "branchcodeCategory": String,
    "instituteCategory": String
  },
  "city": String,
  "additionalMetadata": mongoose.Schema.Types.Mixed
});

// Collection: downtimePayments
export const DowntimePaymentsSchema = new mongoose.Schema({
  "id": String
});

// Collection: dynamicScreens
export const DynamicScreensSchema = new mongoose.Schema({
  "id": String,
  "title": String,
  "html": mongoose.Schema.Types.Mixed,
  "url": String,
  "isPremiumOnly": Boolean,
  "data": [
    {
      "title": String,
      "url": String,
      "html": mongoose.Schema.Types.Mixed,
      "isPremiumOnly": Boolean,
      "plan": String
    }
  ],
  "updatedAt": String
});

// Collection: landingPage
export const LandingPageSchema = new mongoose.Schema({
  "id": String,
  "address": {
    "value": String,
    "link": String
  },
  "company": {
    "name": String
  },
  "youtube": String,
  "whatsapp": {
    "groupinvite": String,
    "number": String
  },
  "phone": String,
  "updatedAt": String,
  "recommended_colleges": [
    {
      "id": String,
      "instituteCode": String,
      "instituteName": String,
      "branches": [
        {
          "branchCode": String,
          "branchName": String,
          "branchShort": String,
          "cutoffs": [
            {
              "category": String,
              "percentile": Number,
              "rank": Number,
              "capRound": String,
              "year": Number
            }
          ]
        }
      ],
      "city": String,
      "keywords": [String],
      "additionalMetadata": {
        "status": String,
        "totalIntake": Number,
        "autonomyStatus": String,
        "minorityStatus": String,
        "address": String,
        "region": String,
        "university": String
      }
    }
  ],
  "cutoff_video": String,
  "events": [
    {
      "id": String,
      "title": String,
      "date": String,
      "description": String,
      "type": String,
      "link": String
    }
  ],
  "updates": [
    {
      "id": String,
      "title": String,
      "subtitle": String,
      "type": String,
      "date": String,
      "link": String,
      "thumbnail": String
    }
  ],
  "banners": [
    {
      "id": String,
      "title": String,
      "url": String,
      "bannerUrl": String,
      "isInAppNavigation": Boolean,
      "isForCounsellingDashboard": Boolean,
      "html": String
    }
  ],
  "testimonials": [
    {
      "name": String,
      "designation": String,
      "feedback": String
    }
  ],
  "slogan": {
    "0": String,
    "1": String,
    "2": String,
    "3": String,
    "4": String,
    "5": String,
    "6": String,
    "7": String,
    "8": String,
    "9": String,
    "10": String,
    "11": String,
    "12": String,
    "13": String,
    "14": String,
    "15": String,
    "16": String,
    "17": String,
    "18": String,
    "19": String,
    "20": String,
    "21": String,
    "22": String,
    "23": String,
    "24": String,
    "25": String,
    "26": String,
    "27": String,
    "28": String,
    "29": String,
    "30": String,
    "31": String,
    "32": String,
    "marathi": String,
    "english": String
  },
  "features": [
    {
      "0": String,
      "1": String,
      "2": String,
      "3": String,
      "4": String,
      "5": String,
      "6": String,
      "7": String,
      "8": String,
      "9": String,
      "10": String,
      "11": String,
      "12": String,
      "13": String,
      "14": String,
      "15": String,
      "16": String,
      "17": String,
      "18": String,
      "19": String,
      "20": String,
      "21": String,
      "22": String,
      "23": String,
      "24": String,
      "25": String,
      "26": String,
      "27": String,
      "28": String,
      "29": String,
      "30": String,
      "31": String,
      "32": String,
      "33": String,
      "34": String,
      "35": String,
      "36": String,
      "37": String,
      "38": String,
      "39": String,
      "40": String,
      "41": String,
      "42": String,
      "43": String,
      "44": String,
      "45": String,
      "46": String,
      "47": String,
      "48": String,
      "49": String,
      "50": String,
      "51": String,
      "52": String,
      "53": String,
      "54": String,
      "55": String,
      "56": String,
      "57": String,
      "58": String,
      "59": String,
      "60": String,
      "61": String,
      "62": String,
      "63": String,
      "64": String,
      "65": String,
      "66": String,
      "67": String,
      "68": String,
      "69": String,
      "70": String,
      "71": String,
      "72": String,
      "73": String,
      "74": String,
      "75": String,
      "76": String,
      "77": String,
      "78": String,
      "79": String,
      "80": String,
      "81": String,
      "english": String,
      "marathi": String
    }
  ],
  "ctaText": {
    "marathi": String,
    "english": String
  },
  "videoUrl": String,
  "title": {
    "0": String,
    "1": String,
    "2": String,
    "3": String,
    "4": String,
    "5": String,
    "6": String,
    "marathi": String,
    "english": String
  },
  "plans": [
    {
      "title": String,
      "price": Number,
      "opensAt": {
        "_seconds": Number,
        "_nanoseconds": Number
      },
      "form": String,
      "isLocked": Boolean,
      "lockedText": String,
      "buttonText": String,
      "benefits": [String]
    }
  ],
  "data": [
    {
      "firstName": String,
      "lastName": String,
      "feedback": String,
      "college": String,
      "branch": String,
      "id": String,
      "timestamp": String,
      "district": String,
      "gender": String,
      "featured": Boolean,
      "photoUrl": String
    }
  ]
});

// Collection: list_folders
export const List_foldersSchema = new mongoose.Schema({
  "id": String,
  "name": String,
  "isArchive": mongoose.Schema.Types.Mixed,
  "createdBy": String,
  "createdAt": mongoose.Schema.Types.Mixed,
  "updatedAt": mongoose.Schema.Types.Mixed,
  "list_count": Number
});

// Collection: lists
export const ListsSchema = new mongoose.Schema({
  "id": String,
  "title": String,
  "colleges": {
    "0": {
      "id": String,
      "instituteCode": String,
      "instituteName": String,
      "city": String,
      "uniqueId": String,
      "selectedBranch": String,
      "selectedBranchCode": String,
      "category": String,
      "originalIndex": Number
    }
  },
  "userIds": [mongoose.Schema.Types.Mixed],
  "createdAt": String,
  "lastUpdatedBy": String,
  "createdBy": String,
  "folderId": mongoose.Schema.Types.Mixed,
  "updatedAt": String,
  "category": String,
  "deletedAt": String,
  "isDeleted": Boolean,
  "deleteFolderId": String
});

// Collection: metadata
export const MetadataSchema = new mongoose.Schema({
  "id": String,
  "userIdList": [String],
  "version": Number,
  "enabled": [String],
  "total": [String]
});

// Collection: notes
export const NotesSchema = new mongoose.Schema({
  "id": String,
  "note-adityachawale14@gmail.com": {
    "createdAt": String,
    "note": String
  },
  "note-yasharadhyeapp@gmail.com": {
    "createdAt": String,
    "note": String
  },
  "note-mayankmchandratre@gmail.com": {
    "createdAt": String,
    "note": String
  }
});

// Collection: paymentLogs
export const PaymentLogsSchema = new mongoose.Schema({
  "id": String,
  "eventType": String,
  "data": {
    "payment": {
      "id": String,
      "entity": String,
      "amount": Number,
      "amount_captured": mongoose.Schema.Types.Mixed,
      "currency": String,
      "base_amount": Number,
      "status": String,
      "order_id": String,
      "invoice_id": mongoose.Schema.Types.Mixed,
      "international": Boolean,
      "method": String,
      "amount_refunded": Number,
      "amount_transferred": Number,
      "refund_status": mongoose.Schema.Types.Mixed,
      "captured": Boolean,
      "description": String,
      "card_id": mongoose.Schema.Types.Mixed,
      "bank": mongoose.Schema.Types.Mixed,
      "wallet": mongoose.Schema.Types.Mixed,
      "vpa": String,
      "email": String,
      "contact": String,
      "notes": {
        "customerPlan": String,
        "planDetails": String,
        "planTitle": String,
        "userPhone": String
      },
      "fee": Number,
      "tax": Number,
      "error_code": mongoose.Schema.Types.Mixed,
      "error_description": mongoose.Schema.Types.Mixed,
      "error_source": mongoose.Schema.Types.Mixed,
      "error_step": mongoose.Schema.Types.Mixed,
      "error_reason": mongoose.Schema.Types.Mixed,
      "acquirer_data": {
        "rrn": String
      },
      "created_at": Number,
      "provider": mongoose.Schema.Types.Mixed,
      "upi": {
        "payer_account_type": String,
        "vpa": String
      },
      "reward": mongoose.Schema.Types.Mixed
    },
    "order": {
      "id": String,
      "entity": String,
      "amount": Number,
      "amount_paid": Number,
      "amount_due": Number,
      "currency": String,
      "receipt": String,
      "offer_id": mongoose.Schema.Types.Mixed,
      "status": String,
      "attempts": Number,
      "notes": {
        "planTitle": String,
        "userPhone": String,
        "planDetails": String,
        "customerPlan": String
      },
      "created_at": Number
    },
    "id": String,
    "entity": String,
    "amount": Number,
    "currency": String,
    "status": String,
    "order_id": String,
    "invoice_id": mongoose.Schema.Types.Mixed,
    "international": Boolean,
    "method": String,
    "amount_refunded": Number,
    "amount_transferred": Number,
    "refund_status": mongoose.Schema.Types.Mixed,
    "captured": Boolean,
    "description": String,
    "card_id": mongoose.Schema.Types.Mixed,
    "bank": mongoose.Schema.Types.Mixed,
    "wallet": mongoose.Schema.Types.Mixed,
    "vpa": mongoose.Schema.Types.Mixed,
    "email": String,
    "contact": String,
    "notes": {
      "customerPlan": String,
      "planDetails": String,
      "planTitle": String,
      "userPhone": String
    },
    "fee": Number,
    "tax": mongoose.Schema.Types.Mixed,
    "error_code": mongoose.Schema.Types.Mixed,
    "error_description": mongoose.Schema.Types.Mixed,
    "error_source": mongoose.Schema.Types.Mixed,
    "error_step": mongoose.Schema.Types.Mixed,
    "error_reason": mongoose.Schema.Types.Mixed,
    "acquirer_data": {
      "rrn": String,
      "auth_code": String,
      "authentication_reference_number": String
    },
    "created_at": Number,
    "provider": mongoose.Schema.Types.Mixed,
    "upi": {
      "payer_account_type": String,
      "vpa": String,
      "flow": String
    },
    "reward": mongoose.Schema.Types.Mixed,
    "card": {
      "emi": Boolean,
      "entity": String,
      "id": String,
      "iin": String,
      "international": Boolean,
      "issuer": String,
      "last4": String,
      "name": String,
      "network": String,
      "sub_type": String,
      "type": String
    }
  },
  "timestamp": Date
});

// Collection: permissions
export const PermissionsSchema = new mongoose.Schema({
  "id": String,
  "pages": [String]
});

// Collection: registrationForm
export const RegistrationFormSchema = new mongoose.Schema({
  "id": String,
  "updatedAt": String,
  "steps": [
    {
      "fields": [
        {
          "options": [mongoose.Schema.Types.Mixed],
          "key": String,
          "type": String,
          "label": String,
          "id": String,
          "required": Boolean
        }
      ],
      "title": String
    }
  ]
});

// Collection: users
export const UsersSchema = new mongoose.Schema({
  "id": String,
  "phone": String,
  "isPremium": Boolean,
  "createdAt": Date,
  "premiumPlan": mongoose.Schema.Types.Mixed,
  "batch": String,
  "otpExpiry": mongoose.Schema.Types.Mixed,
  "currentDeviceId": String,
  "hasLoggedIn": Boolean,
  "firstLogin": Boolean,
  "phoneVerified": Boolean,
  "otp": mongoose.Schema.Types.Mixed,
  "name": String,
  "email": String,
  "oneSignalId": String,
  "currentOrderId": String,
  "orderIds": [String],
  "orders": {
    "0": {
      "orderId": String,
      "amount": Number,
      "currency": String,
      "receipt": String,
      "status": String,
      "notes": {
        "customerPlan": String,
        "planDetails": String,
        "planTitle": String,
        "userPhone": String
      },
      "createdAt": Date,
      "paymentStatus": String,
      "paymentFailureDetails": {
        "acquirer_data": {
          "rrn": mongoose.Schema.Types.Mixed
        },
        "amount": Number,
        "amount_refunded": Number,
        "bank": mongoose.Schema.Types.Mixed,
        "captured": Boolean,
        "card_id": mongoose.Schema.Types.Mixed,
        "contact": String,
        "created_at": Number,
        "currency": String,
        "description": String,
        "email": String,
        "entity": String,
        "error_code": String,
        "error_description": String,
        "error_reason": String,
        "error_source": String,
        "error_step": String,
        "fee": Number,
        "id": String,
        "international": Boolean,
        "invoice_id": mongoose.Schema.Types.Mixed,
        "method": String,
        "notes": {
          "customerPlan": String,
          "planDetails": String,
          "planTitle": String,
          "userPhone": String
        },
        "order_id": String,
        "provider": mongoose.Schema.Types.Mixed,
        "refund_status": mongoose.Schema.Types.Mixed,
        "reward": mongoose.Schema.Types.Mixed,
        "status": String,
        "tax": Number,
        "upi": {
          "flow": String,
          "vpa": mongoose.Schema.Types.Mixed
        },
        "vpa": mongoose.Schema.Types.Mixed,
        "wallet": mongoose.Schema.Types.Mixed
      },
      "updatedAt": Date,
      "paymentId": String,
      "paymentDetails": {
        "id": String,
        "entity": String,
        "amount": Number,
        "amount_captured": mongoose.Schema.Types.Mixed,
        "currency": String,
        "base_amount": Number,
        "status": String,
        "order_id": String,
        "invoice_id": mongoose.Schema.Types.Mixed,
        "international": Boolean,
        "method": String,
        "amount_refunded": Number,
        "amount_transferred": Number,
        "refund_status": mongoose.Schema.Types.Mixed,
        "captured": Boolean,
        "description": String,
        "card_id": mongoose.Schema.Types.Mixed,
        "bank": mongoose.Schema.Types.Mixed,
        "wallet": mongoose.Schema.Types.Mixed,
        "vpa": String,
        "email": String,
        "contact": String,
        "notes": {
          "customerPlan": String,
          "planDetails": String,
          "planTitle": String,
          "userPhone": String
        },
        "fee": Number,
        "tax": Number,
        "error_code": mongoose.Schema.Types.Mixed,
        "error_description": mongoose.Schema.Types.Mixed,
        "error_source": mongoose.Schema.Types.Mixed,
        "error_step": mongoose.Schema.Types.Mixed,
        "error_reason": mongoose.Schema.Types.Mixed,
        "acquirer_data": {
          "rrn": String
        },
        "created_at": Number,
        "provider": mongoose.Schema.Types.Mixed,
        "upi": {
          "payer_account_type": String,
          "vpa": String,
          "flow": String
        },
        "reward": mongoose.Schema.Types.Mixed
      },
      "orderDetails": {
        "id": String,
        "entity": String,
        "amount": Number,
        "amount_paid": Number,
        "amount_due": Number,
        "currency": String,
        "receipt": String,
        "offer_id": mongoose.Schema.Types.Mixed,
        "status": String,
        "attempts": Number,
        "notes": {
          "planTitle": String,
          "userPhone": String,
          "planDetails": String,
          "customerPlan": String
        },
        "created_at": Number
      }
    }
  },
  "counsellingData": {
    "fullName": String,
    "dob": String,
    "city": String,
    "category": String,
    "isDefense": String,
    "isPwd": String,
    "boardMarks": String,
    "boardType": String,
    "cetPercentile": String,
    "jeeMarks": String,
    "jeePercentile": String,
    "jeeSeatNumber": String,
    "cetMarks": String,
    "cetSeatNumber": String,
    "budget": String,
    "termsAccepted": Boolean,
    "preferredLocations": String,
    "email": String,
    "name": String
  },
  "stepsData": {
    "id": String,
    "steps": {
      "0": {
        "number": Number,
        "title": String,
        "description": String,
        "showListButton": Boolean,
        "isLocked": Boolean,
        "premiumOnly": Boolean,
        "isCapSpecific": Boolean,
        "cap": Number,
        "isVerdict": Boolean,
        "isCapQuery": Boolean,
        "collegeName": String,
        "branchCode": String,
        "verdict": String,
        "data": mongoose.Schema.Types.Mixed,
        "status": mongoose.Schema.Types.Mixed,
        "remark": mongoose.Schema.Types.Mixed,
        "accept": Boolean
      }
    }
  },
  "lists": {
    "0": {
      "id": String,
      "originalListId": String,
      "title": String,
      "colleges": {
        "0": {
          "id": String,
          "instituteCode": String,
          "instituteName": String,
          "city": String,
          "uniqueId": String,
          "selectedBranch": String,
          "selectedBranchCode": String,
          "category": String,
          "originalIndex": Number,
          "branches": [
            {
              "branchCode": String,
              "branchName": String,
              "branchShort": String,
              "cutoffs": [
                {
                  "category": String,
                  "percentile": Number,
                  "rank": Number,
                  "capRound": String,
                  "year": Number
                }
              ]
            }
          ],
          "keywords": [String],
          "additionalMetadata": {
            "status": String,
            "totalIntake": Number,
            "autonomyStatus": String,
            "minorityStatus": String,
            "address": String,
            "region": String,
            "university": String,
            "fees": Number,
            "feesSource": String
          }
        }
      },
      "createdAt": String,
      "updatedAt": String,
      "customized": Boolean,
      "isCustomized": Boolean,
      "listId": String,
      "lastUpdatedBy": String
    }
  },
  "createdList": [mongoose.Schema.Types.Mixed]
});


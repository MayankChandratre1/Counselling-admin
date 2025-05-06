import { db } from "../../config/firebase.js";
import fs from 'fs/promises';
import path from 'path';

class CollegeService {
    constructor() {
        this.db = db;
        this.collegeUpdates = db.collection('college_updates');
        this.metadata = db.collection('metadata');
        this.COLLEGES_FILE_PATH = path.join(process.cwd(), 'src/data/College_New_Data_2.json');
    }

    async getAllColleges(page = 1, limit = 10, lastDocId = null) {
        try {
            const collegesData = JSON.parse(await fs.readFile(this.COLLEGES_FILE_PATH, 'utf8'));
            
            // Find starting index based on lastDocId or page number
            let startIndex = 0;
            if (lastDocId) {
                const lastDocIndex = collegesData.findIndex(college => college.id === lastDocId);
                if (lastDocIndex !== -1) {
                    startIndex = lastDocIndex + 1;
                }
            } else {
                startIndex = (page - 1) * limit;
            }
            
            // Get paginated data
            const paginatedColleges = collegesData.slice(startIndex, startIndex + parseInt(limit));
            
            return {
                colleges: paginatedColleges,
                totalCount: collegesData.length,
                currentPage: page,
                totalPages: Math.ceil(collegesData.length / limit),
                hasMore: startIndex + parseInt(limit) < collegesData.length,
                nextLastDocId: paginatedColleges.length > 0 ? paginatedColleges[paginatedColleges.length - 1].id : null
            };
        } catch (error) {
            console.error('Error getting colleges:', error);
            throw error;
        }
    }

    async getCollegeById(id) {
        try {
            const collegesData = JSON.parse(await fs.readFile(this.COLLEGES_FILE_PATH, 'utf8'));
            const college = collegesData.find(college => college.id === id);
            
            if (!college) {
                throw new Error('College not found');
            }
            
            return college;
        } catch (error) {
            console.error(`Error getting college with ID ${id}:`, error);
            throw error;
        }
    }

    async searchColleges(filters = {}) {
        try {
            const collegesData = JSON.parse(await fs.readFile(this.COLLEGES_FILE_PATH, 'utf8'));
            
            let filteredColleges = [...collegesData];
            
            // Apply filters
            if (filters.instituteName) {
                filteredColleges = filteredColleges.filter(college => 
                    college.instituteName?.toLowerCase().includes(filters.instituteName.toLowerCase()) ||
                    this.matchesKeywords(college.keywords, filters.instituteName)
                );
            }
            
            if (filters.instituteCode) {
                filteredColleges = filteredColleges.filter(college => 
                    college.instituteCode?.toString() === filters.instituteCode.toString()
                );
            }
            
            if (filters.city) {
                filteredColleges = filteredColleges.filter(college => 
                    college.city?.toLowerCase().includes(filters.city.toLowerCase())
                );
            }
            
            if (filters.status) {
                filteredColleges = filteredColleges.filter(college => 
                    college.additionalMetadata?.autonomyStatus?.toLowerCase() === filters.status.toLowerCase()
                );
            }
            if (filters.query) {
                filteredColleges = filteredColleges.filter(college => 
                    college.instituteName?.toLowerCase().includes(filters.query.toLowerCase()) ||
                    this.matchesKeywords(college.keywords, filters.query)
                );
            }
            
            // Apply pagination if provided
            const page = parseInt(filters.page) || 1;
            const limit = parseInt(filters.limit) || 10;
            const startIndex = (page - 1) * limit;
            const paginatedResults = filteredColleges.slice(startIndex, startIndex + limit);
            
            return {
                colleges: paginatedResults,
                totalCount: filteredColleges.length,
                currentPage: page,
                totalPages: Math.ceil(filteredColleges.length / limit),
                hasMore: (page * limit) < filteredColleges.length
            };
        } catch (error) {
            console.error('Error searching colleges:', error);
            throw error;
        }
    }

    async createCollege(collegeData) {
        try {
            // 1. Read current data
            const collegesData = JSON.parse(await fs.readFile(this.COLLEGES_FILE_PATH, 'utf8'));
            
            // 2. Check if college with same ID exists
            if (collegesData.some(college => college.id === collegeData.id)) {
                throw new Error('College with this ID already exists');
            }
            
            // 3. Add new college to JSON array
            collegesData.push(collegeData);
            
            // 4. Write back to JSON file
            await fs.writeFile(this.COLLEGES_FILE_PATH, JSON.stringify(collegesData, null, 2));
            
            // 5. Update database
            await this.collegeUpdates.doc(collegeData.id).set(collegeData);
            
            // 6. Update version
            await this.incrementVersion();
            
            return collegeData;
        } catch (error) {
            console.error('Error creating college:', error);
            throw error;
        }
    }

    async updateCollege(id, updatedData) {
        try {
            
            
            // 1. Read current data
            const collegesData = JSON.parse(await fs.readFile(this.COLLEGES_FILE_PATH, 'utf8'));
            
            // 2. Find the college to update
            const collegeIndex = collegesData.findIndex(college => college.id === id);
            if (collegeIndex === -1) {
                throw new Error('College not found');
            }
            
            // 3. Update the college data
            const updatedCollege = { ...collegesData[collegeIndex], ...updatedData };
            collegesData[collegeIndex] = updatedCollege;
            
            // 4. Write back to JSON file
            await fs.writeFile(this.COLLEGES_FILE_PATH, JSON.stringify(collegesData, null, 2));
            console.log('Updated college in Firestore:');

            //check if doc exists in firestore
            const collegeDoc = await this.collegeUpdates.doc(id).get();
            if (!collegeDoc.exists) {
                console.log('Document does not exist in Firestore, creating new document');
                // If it doesn't exist, create a new document
                await this.collegeUpdates.doc(id).set(updatedData);
            } else {
                console.log('Document exists in Firestore, updating document');
                // If it exists, update the document
                await this.collegeUpdates.doc(id).update(updatedData);
            }
            
            
            // 6. Update version
            await this.incrementVersion();
            
            return updatedCollege;
        } catch (error) {
            console.error(`Error updating college with ID ${id}:`, error);
            throw error;
        }
    }

    async deleteCollege(id) {
        try {
            // 1. Read current data
            const collegesData = JSON.parse(await fs.readFile(this.COLLEGES_FILE_PATH, 'utf8'));
            
            // 2. Find the college to delete
            const collegeIndex = collegesData.findIndex(college => college.id === id);
            if (collegeIndex === -1) {
                throw new Error('College not found');
            }
            
            // 3. Remove the college
            const deletedCollege = collegesData.splice(collegeIndex, 1)[0];
            
            // 4. Write back to JSON file
            await fs.writeFile(this.COLLEGES_FILE_PATH, JSON.stringify(collegesData, null, 2));
            
            // 5. Update database - add a deleted field
            await this.collegeUpdates.doc(id).set({ deleted: true });
            
            // 6. Update version
            await this.incrementVersion();
            
            return deletedCollege;
        } catch (error) {
            console.error(`Error deleting college with ID ${id}:`, error);
            throw error;
        }
    }

    async incrementVersion() {
        const metadataRef = this.metadata.doc('colleges');
        
        try {
            // Run transaction to safely update version
            await this.db.runTransaction(async (transaction) => {
                const metadataDoc = await transaction.get(metadataRef);
                
                if (!metadataDoc.exists) {
                    // Initialize with version 1 if doesn't exist
                    transaction.set(metadataRef, { version: 1 });
                    return;
                }
                
                const currentVersion = metadataDoc.data().version;
                // Simply increment the integer version
                const newVersion = (typeof currentVersion === 'number') ? 
                    currentVersion + 1 : 
                    // If current version is not a number (like from old format), start at 1
                    1;
                
                transaction.update(metadataRef, { version: newVersion });
            });
        } catch (error) {
            console.error('Error incrementing version:', error);
            throw error;
        }
    }

    // Helper function to check if search term matches keywords
    matchesKeywords(keywords, searchTerm) {
        if (!keywords || !Array.isArray(keywords)) return false;
        
        const searchTermLower = searchTerm.toLowerCase();
        
        // Check if any keyword contains the search term
        return keywords.map(keyword => keyword.toLowerCase()).includes(searchTermLower) 
    }
}

export default CollegeService;

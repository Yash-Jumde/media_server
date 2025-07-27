const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// Directory for converted videos
const CONVERTED_DIR = path.join(__dirname, '../../converted_videos');

// Create directory if it doesn't exist
if(!fs.existsSync(CONVERTED_DIR)) {
    fs.mkdirSync(CONVERTED_DIR, {recursive: true});
}

/**
 * Checks if a file needs conversion
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if conversion is needed
 */
const needsConversion = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return ['.mkv', '.avi', '.wmv', '.flv'].includes(ext);
};

/**
 * Converts video to MP4 format with high quality settings
 * @param {string} videoPath - Path to the source video
 * @returns {Promise<string>} - Path to the converted video
 */
const convertToMP4 = (videoPath) => {
    return new Promise((resolve, reject) => {
        const filename = path.basename(videoPath);
        const basename = path.parse(filename).name;
        const outputPath = path.join(CONVERTED_DIR, `${basename}.mp4`);
        
        // Check if file already exists and is not empty
        if(fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            console.log(`Using existing converted file: ${outputPath}`);
            return resolve(outputPath);
        }
        
        console.log(`Starting conversion of ${filename} to MP4...`);
        
        // High quality conversion command
        const command = `"${ffmpegPath}" -i "${videoPath}" -c:v libx264 -crf 20 -preset medium -c:a aac -b:a 192k "${outputPath}"`;
        
        // Create a temporary file to indicate conversion in progress
        const tempPath = `${outputPath}.converting`;
        fs.writeFileSync(tempPath, '');
        
        exec(command, (error, stdout, stderr) => {
            // Clean up temp file regardless of outcome
            if(fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            
            if(error) {
                console.error(`Error converting video: ${error}`);
                return reject(error);
            }
            
            // Verify the output file exists and has content
            if(fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                console.log(`Conversion complete: ${filename} -> ${basename}.mp4`);
                resolve(outputPath);
            } else {
                reject(new Error(`Conversion failed: Output file missing or empty`));
            }
        });
    });
};

/**
 * Gets the path to a web-friendly version of the video
 * @param {string} videoPath - Original video path
 * @returns {Promise<string>} - Path to web-friendly video or original if conversion not needed
 */
const getWebFriendlyPath = async (videoPath) => {
    if (needsConversion(videoPath)) {
        try {
            console.log(`Getting web-friendly path for: ${videoPath}`);
            return await convertToMP4(videoPath);
        } catch (error) {
            console.error(`Conversion failed, falling back to original: ${error}`);
            return videoPath; // Fallback to original if conversion fails
        }
    }
    return videoPath; // Already web-friendly
};

module.exports = {
    convertToMP4,
    needsConversion,
    getWebFriendlyPath,
    CONVERTED_DIR
};
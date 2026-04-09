const fs = require('fs');
const path = require('path');

function convertSrtToVtt(srtContent) {
    // Remove Byte Order Mark (BOM) if present
    const cleanContent = srtContent.replace(/^\uFEFF/, '');
    
    // Convert SRT to VTT format
    const vttContent = 'WEBVTT\n\n' + cleanContent
        .replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2')  // Replace comma with dot in timestamps
        .replace(/\r\n/g, '\n');                         // Normalize line endings
    
    return vttContent;
}

const srtPath = '/home/waltazar/media_server/media_server/media/movies/Reservoir Dogs (1992) [1080p]/Reservoir Dogs (1992).srt';

try {
    const srtContent = fs.readFileSync(srtPath, 'utf8');
    const vttContent = convertSrtToVtt(srtContent);
    
    console.log('--- VTT Content Preview (First 200 chars) ---');
    console.log(vttContent.substring(0, 200));
    console.log('--- End Preview ---');
    
    // Check for dot in timestamps
    const hasDot = vttContent.includes('.');
    const hasComma = vttContent.includes(',');
    console.log('Contains dot (VTT style):', hasDot);
    console.log('Contains comma (SRT style - in timestamps):', hasComma && vttContent.match(/\d\d:\d\d:\d\d,\d\d\d/) !== null);
    
    // Verify WEVBTT header is at the very beginning
    console.log('Starts with WEBVTT:', vttContent.startsWith('WEBVTT'));
} catch (e) {
    console.error('Error:', e);
}

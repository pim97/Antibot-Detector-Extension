# Building for Chrome Web Store

## Quick Build

Run the build script to create a Web Store-ready `.zip` file:

```powershell
.\build-webstore.ps1
```

This will create `scrappey-detector-webstore.zip` in the project root.

## What's Included

The build script automatically includes:
- All extension files (manifest, scripts, HTML, CSS)
- Icons and assets
- Detector definitions
- Modules and utilities
- html2canvas library

## What's Excluded

The following development files are automatically excluded:
- `scripts/` folder
- `README.md`
- `LICENSE`
- `CHANGELOG.md`
- `.git/` folder
- Any test files

## Testing the Package

Before submitting to Chrome Web Store:

1. **Extract the .zip** to a temporary folder
2. **Open Chrome** and go to `chrome://extensions/`
3. **Enable Developer Mode**
4. **Click "Load unpacked"** and select the extracted folder
5. **Test the extension**:
   - Open popup
   - Visit a website
   - Verify detections work
   - Test screenshot feature
   - Check all icons load

## Submitting to Chrome Web Store

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click **New Item**
3. Upload `scrappey-detector-webstore.zip`
4. Fill in store listing details
5. Submit for review

## Custom Output Name

To specify a custom output filename:

```powershell
.\build-webstore.ps1 -OutputName "my-custom-name.zip"
```


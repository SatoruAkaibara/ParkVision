import cv2
import numpy as np
import os

# Set paths to your files
VIDEO_PATH = "test_video.mp4"
MAP_PATH = "../frontend/src/assets/parking_lot.png" # Adjust to where your map image is

pts_video = []
pts_map = []

def click_video(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN and len(pts_video) < 4:
        pts_video.append([x, y])
        cv2.circle(img_video, (x, y), 5, (0, 0, 255), -1)
        cv2.imshow("1. Click 4 corners on VIDEO", img_video)

def click_map(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN and len(pts_map) < 4:
        pts_map.append([x, y])
        cv2.circle(img_map, (x, y), 5, (0, 255, 0), -1)
        cv2.imshow("2. Click matching 4 corners on MAP", img_map)

print("Opening video...")
cap = cv2.VideoCapture(VIDEO_PATH)
ret, img_video = cap.read()
cap.release()

if not ret:
    print("Could not read video.")
    exit()

print("Opening map image...")
img_map = cv2.imread(MAP_PATH)
if img_map is None:
    print("Could not read map image. Check path.")
    exit()

# Force map to be 800x600 to match React canvas
img_map = cv2.resize(img_map, (800, 600))

print("👉 Step 1: Click 4 corners of the parking area on the VIDEO.")
cv2.imshow("1. Click 4 corners on VIDEO", img_video)
cv2.setMouseCallback("1. Click 4 corners on VIDEO", click_video)
cv2.waitKey(0)
cv2.destroyAllWindows()

print("👉 Step 2: Click the EXACT SAME 4 corners on the MAP.")
cv2.imshow("2. Click matching 4 corners on MAP", img_map)
cv2.setMouseCallback("2. Click matching 4 corners on MAP", click_map)
cv2.waitKey(0)
cv2.destroyAllWindows()

# Replace the last block in calibrate.py with this
if len(pts_video) == 4 and len(pts_map) == 4:
    H, status = cv2.findHomography(
        np.float32(pts_video),
        np.float32(pts_map),
        cv2.RANSAC,   # more robust than the default least-squares
        5.0           # reprojection error threshold in pixels
    )
    if H is not None:
        np.save("homography.npy", H)
        print("\n✅ SUCCESS! Matrix saved to homography.npy")
    else:
        print("\n❌ findHomography failed — try clicking different points")
else:
    print("\n❌ Error: exactly 4 points required on both images.")
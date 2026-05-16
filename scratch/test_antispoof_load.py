import os
import torch
import sys
# Add current directory to path so it can find models.anti_spoofing
sys.path.append(os.getcwd())

from models.anti_spoofing.anti_spoof_predict import AntiSpoofPredict

def test_load():
    model_path = "models/anti_spoofing/2.7_80x80_MiniFASNetV2.pth"
    if not os.path.exists(model_path):
        print(f"FAILED: {model_path} not found")
        return
    
    try:
        predictor = AntiSpoofPredict(0)
        # We don't need a real image just to check if it loads weights
        model = predictor._load_model(model_path)
        print("SUCCESS: Model loaded correctly!")
    except Exception as e:
        print(f"FAILED: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_load()

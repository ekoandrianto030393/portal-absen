import os
import cv2
import torch
import numpy as np
import torch.nn.functional as F
from models.anti_spoofing.model_lib import MiniFASNetV1, MiniFASNetV2, MiniFASNetV1SE, MiniFASNetV2SE

class AntiSpoofPredict:
    def __init__(self, device_id=0):
        if torch.cuda.is_available():
            self.device = torch.device(f"cuda:{device_id}")
        else:
            self.device = torch.device("cpu")
        self.models = {} # Cache untuk menyimpan model yang sudah di-load

    def _load_model(self, model_path):
        if model_path in self.models:
            return self.models[model_path]
            
        # Define model name and model structure
        model_name = os.path.basename(model_path)
        if 'MiniFASNetV2' in model_name:
            model = MiniFASNetV2(keep=0.8, embedding_size=3, conv6_kernel=(5, 5))
        elif 'MiniFASNetV1SE' in model_name:
            model = MiniFASNetV1SE(keep=0.8, embedding_size=3, conv6_kernel=(7, 7))
        else:
            model = MiniFASNetV1(keep=0.8, embedding_size=3, conv6_kernel=(7, 7))

        # load model weight
        state_dict = torch.load(model_path, map_location=self.device)
        
        # Handle module. prefix
        from collections import OrderedDict
        new_state_dict = OrderedDict()
        for k, v in state_dict.items():
            name = k[7:] if k.startswith('module.') else k
            new_state_dict[name] = v
        
        model.load_state_dict(new_state_dict, strict=True)
        model.to(self.device)
        model.eval()
        
        self.models[model_path] = model
        print(f"✅ Model {model_name} dimuat ke memori (Cache Aktif)")
        return model

    def predict(self, img, model_path):
        model = self._load_model(model_path)
        
        # Preprocessing: Resize 80x80 dengan kualitas tinggi (INTER_AREA)
        img = cv2.resize(img, (80, 80), interpolation=cv2.INTER_AREA)
        
        # WAJIB COBA RGB LAGI (Sekarang dengan Square Crop)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Normalization (-1 to 1)
        img = (img.astype(np.float32) - 127.5) / 128.0
        
        img = img.transpose((2, 0, 1))
        img = torch.from_numpy(img).float().unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            result = model.forward(img)
            result = F.softmax(result, dim=1).cpu().numpy()
        
        return result

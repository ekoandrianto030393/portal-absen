import torch
from torch import nn
import torch.nn.functional as F

class Conv_block(nn.Module):
    def __init__(self, in_c, out_c, kernel=(1, 1), stride=(1, 1), padding=(0, 0), groups=1):
        super(Conv_block, self).__init__()
        self.conv = nn.Conv2d(in_c, out_c, kernel_size=kernel, stride=stride, padding=padding, groups=groups, bias=False)
        self.bn = nn.BatchNorm2d(out_c)
        self.prelu = nn.PReLU(out_c)

    def forward(self, x):
        x = self.conv(x)
        x = self.bn(x)
        x = self.prelu(x)
        return x

class Linear_block(nn.Module):
    def __init__(self, in_c, out_c, kernel=(1, 1), stride=(1, 1), padding=(0, 0), groups=1):
        super(Linear_block, self).__init__()
        self.conv = nn.Conv2d(in_c, out_c, kernel_size=kernel, stride=stride, padding=padding, groups=groups, bias=False)
        self.bn = nn.BatchNorm2d(out_c)

    def forward(self, x):
        x = self.conv(x)
        x = self.bn(x)
        return x

class Residual_block(nn.Module):
    def __init__(self, in_c, out_c, kernel=(3, 3), stride=(1, 1), padding=(1, 1), groups=1, use_shortcut=True):
        super(Residual_block, self).__init__()
        self.conv = Conv_block(in_c, groups, kernel=(1, 1), stride=(1, 1), padding=(0, 0))
        self.conv_dw = Conv_block(groups, groups, kernel=kernel, stride=stride, padding=padding, groups=groups)
        self.project = Linear_block(groups, out_c, kernel=(1, 1), stride=(1, 1), padding=(0, 0))
        
        # Shortcut hanya jika diminta dan dimensi cocok
        if use_shortcut and stride == 1 and in_c == out_c:
            self.use_res = True
        else:
            self.use_res = False

    def forward(self, x):
        res = self.project(self.conv_dw(self.conv(x)))
        if self.use_res:
            return x + res
        return res

class MiniFASNet(nn.Module):
    def __init__(self, keep, embedding_size=128, conv6_kernel=(5, 5)):
        super(MiniFASNet, self).__init__()
        self.conv1 = Conv_block(3, 32, kernel=(3, 3), stride=(1, 1), padding=(1, 1))
        
        # Ganti dw_conv1 menjadi conv2_dw sesuai file .pth
        self.conv2_dw = Conv_block(32, 32, kernel=(3, 3), stride=(1, 1), padding=(1, 1), groups=32)
        
        # Stride 2 tanpa shortcut
        self.conv_23 = Residual_block(32, 64, kernel=(3, 3), stride=(2, 2), padding=(1, 1), groups=103, use_shortcut=False)
        
        # conv_3: 4 blok dengan 13 groups
        self.conv_3 = nn.ModuleDict({
            "model": nn.Sequential(
                Residual_block(64, 64, stride=2, groups=13, use_shortcut=False), # model.0
                Residual_block(64, 64, stride=1, groups=13), # model.1
                Residual_block(64, 64, stride=1, groups=13), # model.2
                Residual_block(64, 64, stride=1, groups=13)  # model.3
            )
        })
        
        self.conv_34 = Residual_block(64, 128, kernel=(3, 3), stride=(1, 1), padding=(1, 1), groups=231, use_shortcut=False)
        
        # conv_4: 6 blok dengan groups bervariasi: 231, 52, 26, 77, 26, 26
        self.conv_4 = nn.ModuleDict({
            "model": nn.Sequential(
                Residual_block(128, 128, stride=2, groups=231, use_shortcut=False), # model.0
                Residual_block(128, 128, stride=1, groups=52),  # model.1
                Residual_block(128, 128, stride=1, groups=26),  # model.2
                Residual_block(128, 128, stride=1, groups=77),  # model.3
                Residual_block(128, 128, stride=1, groups=26),  # model.4
                Residual_block(128, 128, stride=1, groups=26)   # model.5
            )
        })
        
        self.conv_45 = Residual_block(128, 128, kernel=(3, 3), stride=(1, 1), padding=(1, 1), groups=308, use_shortcut=False)
        
        # conv_5: 2 blok dengan 26 groups
        self.conv_5 = nn.ModuleDict({
            "model": nn.Sequential(
                Residual_block(128, 128, stride=2, groups=26, use_shortcut=False), # model.0
                Residual_block(128, 128, stride=1, groups=26)  # model.1
            )
        })
        
        self.conv_6_sep = Conv_block(128, 512, kernel=(1, 1), stride=(1, 1), padding=(0, 0))
        self.conv_6_dw = Linear_block(512, 512, kernel=conv6_kernel, stride=(1, 1), padding=(0, 0), groups=512)
        
        # Sesuai file .pth: linear (512->128) -> bn -> prob (128->3)
        self.linear = nn.Linear(512, 128, bias=False)
        self.bn = nn.BatchNorm1d(128)
        self.prob = nn.Linear(128, embedding_size, bias=False) # embedding_size = 3

    def forward(self, x):
        out = self.conv1(x)
        out = self.conv2_dw(out)
        out = self.conv_23(out)
        out = self.conv_3["model"](out)
        out = self.conv_34(out)
        out = self.conv_4["model"](out)
        out = self.conv_45(out)
        out = self.conv_5["model"](out)
        out = self.conv_6_sep(out)
        out = self.conv_6_dw(out)
        out = out.view(out.size(0), -1)
        out = self.linear(out)
        out = self.bn(out)
        out = self.prob(out)
        return out

class MiniFASNetV1(MiniFASNet):
    def __init__(self, keep, embedding_size=128, conv6_kernel=(7, 7)):
        super(MiniFASNetV1, self).__init__(keep, embedding_size, conv6_kernel)

class MiniFASNetV2(MiniFASNet):
    def __init__(self, keep, embedding_size=128, conv6_kernel=(5, 5)):
        super(MiniFASNetV2, self).__init__(keep, embedding_size, conv6_kernel)

class MiniFASNetV1SE(MiniFASNet):
    def __init__(self, keep, embedding_size=128, conv6_kernel=(7, 7)):
        super(MiniFASNetV1SE, self).__init__(keep, embedding_size, conv6_kernel)

class MiniFASNetV2SE(MiniFASNet):
    def __init__(self, keep, embedding_size=128, conv6_kernel=(5, 5)):
        super(MiniFASNetV2SE, self).__init__(keep, embedding_size, conv6_kernel)

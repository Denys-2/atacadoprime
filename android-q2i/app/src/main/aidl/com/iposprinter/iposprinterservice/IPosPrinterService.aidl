package com.iposprinter.iposprinterservice;

import com.iposprinter.iposprinterservice.IPosPrinterCallback;
import android.graphics.Bitmap;

interface IPosPrinterService {
    int getPrinterStatus();
    void printerInit(IPosPrinterCallback callback);
    void setPrinterPrintDepth(int depth, IPosPrinterCallback callback);
    void setPrinterPrintFontType(String typeface, IPosPrinterCallback callback);
    void setPrinterPrintFontSize(int fontsize, IPosPrinterCallback callback);
    void setPrinterPrintAlignment(int alignment, IPosPrinterCallback callback);
    void printerFeedLines(int lines, IPosPrinterCallback callback);
    void printBlankLines(int lines, int height, IPosPrinterCallback callback);
    void printText(String text, IPosPrinterCallback callback);
    void printSpecifiedTypeText(String text, String typeface, int fontsize, IPosPrinterCallback callback);
    void PrintSpecFormatText(String text, String typeface, int fontsize, int alignment, IPosPrinterCallback callback);
    void printColumnsText(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, int isContinuousPrint, IPosPrinterCallback callback);
    void printBitmap(int alignment, int bitmapSize, in Bitmap bitmap, IPosPrinterCallback callback);
    void printBarCode(String data, int symbology, int height, int width, int textposition, IPosPrinterCallback callback);
    void printQRCode(String data, int modulesize, int errorCorrectionLevel, IPosPrinterCallback callback);
    void printRawData(in byte[] rawPrintData, IPosPrinterCallback callback);
    void sendUserCMDData(in byte[] data, IPosPrinterCallback callback);
    void printerPerformPrint(int feedlines, IPosPrinterCallback callback);
}

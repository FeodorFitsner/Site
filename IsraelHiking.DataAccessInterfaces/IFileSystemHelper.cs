﻿using System.IO;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IFileSystemHelper
    {
        bool IsHidden(string path);
        void WriteAllBytes(string filePath, byte[] content);
        void WriteAllText(string filePath, string content);
        string GetCurrentDirectory();
        void CreateDirectory(string path);
        void Move(string sourceFileName, string targetFileName);
        Stream CreateWriteStream(string filePath);
    }
}
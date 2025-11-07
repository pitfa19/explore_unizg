"use client";

import { useState, useRef } from "react";
import CardSpotlight from "@/components/ui/CardSpotlight";
import { useToast } from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import RippleButton from "@/components/ui/Ripple";
import EmptyState from "@/components/ui/EmptyState";

export default function ChatSection() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const fileInputRef = useRef(null);
  const { showToast } = useToast();

  const handleSend = () => {
    if (inputValue.trim() || uploadedFile) {
      const messageText = uploadedFile 
        ? `${inputValue.trim() ? inputValue : ""} 📎 ${uploadedFile.name}`
        : inputValue;
      
      setMessages([...messages, { text: messageText, sender: "user", file: uploadedFile }]);
      setInputValue("");
      setUploadedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      showToast("Poruka poslana!", "success");
      // Simulate response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { text: "Ovo je primjer odgovora.", sender: "assistant" },
        ]);
      }, 500);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === "application/pdf") {
        setUploadedFile(file);
        showToast("PDF datoteka dodana!", "success");
      } else {
        showToast("Molimo odaberite PDF datoteku.", "error");
        e.target.value = "";
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadedFile(file);
      showToast("PDF datoteka dodana!", "success");
    } else if (file) {
      showToast("Molimo odaberite PDF datoteku.", "error");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <section className="w-full py-16 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Postavite pitanja
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Razgovarajte s našim asistentom
          </p>
        </div>
        <CardSpotlight className="rounded-2xl">
          <div className="flex flex-col h-[600px] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
              {messages.length === 0 && (
                <EmptyState
                  title="Započnite razgovor"
                  description="Postavite pitanje ili pošaljite poruku da započnete razgovor s našim asistentom."
                  icon={
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  }
                />
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-2 shadow-sm ${
                      message.sender === "user"
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Input Area */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/50">
              {uploadedFile && (
                <div className="mb-3 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate max-w-[200px]">
                      {uploadedFile.name}
                    </span>
                  </div>
                  <button
                    onClick={removeFile}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                    aria-label="Remove file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div 
                className="flex items-end space-x-4"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div className="flex-1 relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Upišite svoju poruku..."
                    className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[60px] max-h-[200px] transition-all"
                    rows={1}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <Tooltip text="Dodaj PDF datoteku (npr. CV)">
                    <label
                      htmlFor="pdf-upload"
                      className="absolute right-2 bottom-2 p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label="Dodaj PDF datoteku"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </label>
                  </Tooltip>
                </div>
                <RippleButton
                  onClick={handleSend}
                  disabled={!inputValue.trim() && !uploadedFile}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                  aria-label="Pošalji poruku"
                >
                  Pošalji
                </RippleButton>
              </div>
            </div>
          </div>
        </CardSpotlight>
      </div>
    </section>
  );
}


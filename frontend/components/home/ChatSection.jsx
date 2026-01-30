"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import CardSpotlight from "@/components/ui/CardSpotlight";
import { useToast } from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import { processMessage, embedStudentAndKnn } from "@/lib/api/chat";
import { getStudentId, setStudentId, clearStudentId } from "@/lib/storage";

export default function ChatSection() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isCvModalOpen, setIsCvModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const inputAreaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const { showToast } = useToast();

  // Auto-expand when first message is sent
  useEffect(() => {
    if (messages.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Scroll input bar to bottom when focused or typing
  useEffect(() => {
    if (isInputFocused && inputAreaRef.current) {
      const timer = setTimeout(() => {
        const element = inputAreaRef.current;
        if (element) {
          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const offset = 100;
          const targetScroll = scrollTop + rect.bottom - window.innerHeight + offset;
          window.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isInputFocused, inputValue]);

  // Scroll to input when expanding
  useEffect(() => {
    if (isExpanded && inputAreaRef.current) {
      setTimeout(() => {
        const element = inputAreaRef.current;
        if (element) {
          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const offset = 100;
          const targetScroll = scrollTop + rect.bottom - window.innerHeight + offset;
          window.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
        }
      }, 700);
    }
  }, [isExpanded]);

  // Auto-scroll to bottom of messages when new message is added (internal scroll only)
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0 && isExpanded) {
      setTimeout(() => {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }, 100);
    }
  }, [messages.length, isExpanded]);

  const handleSend = async () => {
    if (isSending) return;
    const trimmed = inputValue.trim();
    if (!trimmed && !uploadedFile) return;

    const messageText = uploadedFile
      ? `${trimmed ? trimmed : ""} 📎 ${uploadedFile.name}`
      : trimmed;

    // Optimistically render user message
    setMessages((prev) => [...prev, { text: messageText, sender: "user", file: uploadedFile }]);

    // Reset input and file picker
    setInputValue("");
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setIsSending(true);
    try {
      const currentId = getStudentId();
      const { answer, studentId } = await processMessage({ text: trimmed, studentId: currentId ?? undefined });

      // Persist/refresh student id
      if (studentId != null) {
        setStudentId(studentId);
      }

      if (answer && answer.trim()) {
        setMessages((prev) => [...prev, { text: answer, sender: "assistant" }]);
      } else {
        showToast("Agent još nema odgovor.", "info");
      }
    } catch (error) {
      const status = error?.status;
      const msg = error?.message || "Došlo je do pogreške.";

      if (status === 404) {
        clearStudentId();
        showToast("Nevažeći razgovor. Sesija je resetirana.", "warning");
      } else if (status === 400) {
        showToast(msg, "error");
      } else {
        showToast("Greška mreže ili poslužitelja. Pokušajte ponovo.", "error");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmbedOnGraph = async () => {
    const currentId = getStudentId();
    if (currentId == null) {
      showToast("Nema aktivnog razgovora.", "warning");
      return;
    }
    try {
      const { neighbors, studentId, name } = await embedStudentAndKnn({ studentId: currentId });
      if (Array.isArray(neighbors) && neighbors.length > 0) {
        const labels = neighbors.map(n => n?.label || n?.name || "").filter(Boolean).slice(0, 3);
        const msg = labels.length ? `Dodano! Najbliži: ${labels.join(", ")}` : "Dodano!";
        showToast(msg, "success");
        // Emit event for the NetworkGraph to add the node and edges
        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new CustomEvent("addStudentNode", { detail: { studentId, name, neighbors } }));
            // Also emit neighbors to side lists (exclude student node)
            const faculties = neighbors
              .filter((n) => (n?.type === "faculty"))
              .map((n) => ({
                label: (n?.label || "").trim(),
                abbreviation: (n?.abbreviation || "").trim(),
                distance: typeof n?.distance === "number" ? n.distance : null,
                cluster: n?.cluster ?? null,
                url: (n?.url || "").trim(),
              }));
            const organisations = neighbors
              .filter((n) => (n?.type === "organisation"))
              .map((n) => ({
                name: (n?.label || n?.name || "").trim(),
                abbreviation: (n?.abbreviation || "").trim(),
                distance: typeof n?.distance === "number" ? n.distance : null,
                cluster: n?.cluster ?? null,
                url: (n?.url || "").trim(),
              }));
            window.dispatchEvent(new CustomEvent("studentNeighbors", { detail: { name, faculties, organisations } }));
          } catch {
            // ignore
          }
        }
      } else {
        showToast("Uspješno spremljeno. Nema pronađenih susjeda.", "info");
      }
    } catch (error) {
      const status = error?.status;
      const msg = error?.message || "Došlo je do pogreške.";
      if (status === 404) {
        showToast("Korisnik nije pronađen.", "warning");
      } else if (status === 400) {
        showToast(msg, "error");
      } else {
        showToast("Greška mreže ili poslužitelja. Pokušajte ponovo.", "error");
      }
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

  const openCvModal = () => setIsCvModalOpen(true);
  const closeCvModal = () => setIsCvModalOpen(false);
  const handleChooseUploadCv = () => {
    closeCvModal();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  const handleChooseCreateAICv = () => {
    closeCvModal();
    showToast("AI CV kreator uskoro!", "info");
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
    if (messages.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const handleInputBlur = () => {
    if (messages.length === 0) {
      setIsInputFocused(false);
    }
  };

  const navigateToSection = (id) => {
    try {
      const el = document.getElementById(id);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Temporary highlight for visual feedback
        el.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-blue-500", "ring-offset-2");
        }, 1200);
      } else {
        window.location.hash = id;
      }
    } catch {
      // ignore
    }
  };

  const renderAssistantText = (text) => {
    const phraseMap = {
      "Pregled poslova": "poslovi",
      "Događaji ovog tjedna": "dogadaji",
      "Studentske udruge": "udruge",
      "Fakulteti": "fakulteti",
    };
    const phrases = Object.keys(phraseMap);
    if (!text || phrases.length === 0) {
      return <p className="text-sm">{text}</p>;
    }
    const pattern = new RegExp(`(${phrases.join("|")})`, "gu");
    const parts = text.split(pattern);
    const nodes = parts.map((part, idx) => {
      if (phrases.includes(part)) {
        const id = phraseMap[part];
        return (
          <a
            key={`lnk-${idx}`}
            href={`/#${id}`}
            onClick={(e) => {
              e.preventDefault();
              navigateToSection(id);
            }}
            className="inline-flex items-center px-3 py-1.5 mx-1 my-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/90 dark:bg-gray-900/70 text-xs md:text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-500 shadow-sm transition-colors"
            aria-label={`Idi na odjeljak ${part}`}
          >
            {part}
          </a>
        );
      }
      return <span key={`txt-${idx}`}>{part}</span>;
    });
    return <p className="text-sm">{nodes}</p>;
  };

  return (
    <section
      className={`w-full py-20 md:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative transition-all duration-300 ${
        isInputFocused || isExpanded ? "pb-24 md:pb-32" : ""
      }`}
    >
      <div className={`max-w-4xl mx-auto ${isInputFocused || isExpanded ? "pb-20 md:pb-28" : ""}`}>
        <div className="text-center mb-12">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Razgovarajte s našim asistentom
          </p>
        </div>
        <CardSpotlight className="rounded-2xl">
          <div className="relative">
            <motion.div
              className="flex flex-col bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden"
              initial={false}
              animate={{
                minHeight: isExpanded && messages.length > 0 ? "300px" : "auto",
                marginBottom: isInputFocused || isExpanded ? "80px" : "0px",
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              {/* Messages Area - expands upwards from input bar */}
              <AnimatePresence>
                {isExpanded && messages.length > 0 && (
                  <motion.div
                    key="messages"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="overflow-hidden flex-1 messages-container"
                  >
                    <div
                      ref={messagesContainerRef}
                      className="overflow-y-auto p-4 md:p-5 space-y-3"
                      role="log"
                      aria-live="polite"
                      aria-label="Chat messages"
                      style={{ maxHeight: "250px", minHeight: "100px" }}
                      onWheel={(e) => {
                        const container = e.currentTarget;
                        const { scrollTop, scrollHeight, clientHeight } = container;
                        const isAtTop = scrollTop === 0;
                        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
                        if ((!isAtTop && e.deltaY < 0) || (!isAtBottom && e.deltaY > 0)) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {messages.map((message, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
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
                          {message.sender === "assistant" ? (
                            renderAssistantText(message.text)
                          ) : (
                            <p className="text-sm">{message.text}</p>
                          )}
                          </div>
                        </motion.div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input Area - always visible at bottom */}
              <div
                ref={inputAreaRef}
                className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/50 relative"
                style={{
                  scrollMarginBottom: isInputFocused || isExpanded ? "80px" : "0px",
                }}
              >
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
                <div className="flex items-end space-x-4">
                  <div 
                    className="flex items-center space-x-4 min-h-[60px] flex-1"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <div className="flex-1 relative h-full min-h-[60px]">
                      <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        placeholder="Upišite svoju poruku..."
                        className="absolute inset-0 w-full h-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-4 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-auto scrollbar-hide"
                        style={{ 
                          lineHeight: '1.5rem',
                          paddingTop: '1.125rem',
                          paddingBottom: '1.125rem',
                          boxSizing: 'border-box'
                        }}
                        rows={1}
                        disabled={isSending}
                      />
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <Tooltip text="CV opcije (učitaj ili AI CV)">
                    <button
                      type="button"
                      onClick={openCvModal}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label="Otvori CV opcije"
                    >
                      <span className="relative inline-flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="absolute -right-2 -bottom-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 select-none">CV</span>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Dodaj na mrezu fakulteta" position="top">
                    <button
                      type="button"
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label="Dodaj na mrezu fakulteta"
                      onClick={handleEmbedOnGraph}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </Tooltip>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending || (!inputValue.trim() && !uploadedFile)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                    aria-label="Pošalji poruku"
                    style={{ alignSelf: 'center' }}
                  >
                    {isSending ? "Slanje..." : "Pošalji"}
                  </button>
                </div>
              </div>

              {/* Expand/Collapse Button removed */}
            </motion.div>
          </div>
        </CardSpotlight>
      </div>
      {isCvModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cv-modal-title"
        >
          <div className="absolute inset-0 bg-black/40" onClick={closeCvModal} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
            <div className="mb-4">
              <h3 id="cv-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">Odaberite opciju za CV</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Učitajte svoj postojeći CV ili izradite AI CV.</p>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleChooseUploadCv}
                className="w-full px-4 py-3 rounded-xl border-2 border-blue-500 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium transition-colors"
              >
                Učitaj svoj CV (PDF)
              </button>
              <button
                type="button"
                onClick={handleChooseCreateAICv}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 font-medium transition-colors"
              >
                Kreiraj AI CV
              </button>
            </div>
            <button
              type="button"
              onClick={closeCvModal}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="Zatvori"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

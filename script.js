const imageInput = document.getElementById("imageInput");
const previewImage = document.getElementById("previewImage");
const promptContainer = document.getElementById("promptContainer");
const promptInput = document.getElementById("promptInput");
const submitBtn = document.getElementById("submitBtn");
const chatHistory = document.getElementById("chatHistory");
const pageWrapper = document.getElementById("pageWrapper");

let selectedImage = null;
let hasFirstResponse = false;

// Handle image preview
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (file) {
    selectedImage = file;
    const reader = new FileReader();
    reader.onload = () => {
      previewImage.src = reader.result;
      previewImage.classList.remove("hidden");
      promptContainer.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }
});

// Handle Analyze button click
submitBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();

  if (!selectedImage || !prompt) {
    alert("Please select an image and enter your prompt.");
    return;
  }

  // Add loading state
  submitBtn.classList.add("loading");
  submitBtn.innerText = "Analyzing...";

  const formData = new FormData();
  formData.append("image", selectedImage);
  formData.append("user_prompt", prompt);

  try {
    const res = await fetch("https://vision-api.onrender.com/analyze", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    const response = data.response || data.error || "No response received.";

    // Switch layout after first response
    if (!hasFirstResponse) {
      pageWrapper.classList.remove("centered");
      pageWrapper.classList.add("split");
      hasFirstResponse = true;
    }

    addToChatHistory(prompt, response);
    promptInput.value = "";
  } catch (err) {
    console.error(err);
    alert("An error occurred while analyzing.");
  } finally {
    submitBtn.classList.remove("loading");
    submitBtn.innerText = "Analyze";
  }
});

// Add prompt/response block to right panel
function addToChatHistory(userPrompt, aiResponse) {
  const block = document.createElement("div");
  block.className = "chat-block";

  const userDiv = document.createElement("div");
  userDiv.className = "user";
  userDiv.innerText = `You: ${userPrompt}`;

  const responseDiv = document.createElement("div");
  responseDiv.className = "response";
  responseDiv.innerText = aiResponse;

  block.appendChild(userDiv);
  block.appendChild(responseDiv);
  chatHistory.appendChild(block);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

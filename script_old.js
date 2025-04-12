const API_URL = "http://127.0.0.1:8000"; // change to your Render backend URL
// const API_URL = "https://vision-api.onrender.com"; // change to your Render backend URL

const imageInput = document.getElementById("imageInput");
const previewImage = document.getElementById("previewImage");
const promptContainer = document.getElementById("promptContainer");
const promptInput = document.getElementById("promptInput");
const submitBtn = document.getElementById("submitBtn");
const chatHistory = document.getElementById("chatHistory");
const pageWrapper = document.getElementById("pageWrapper");

const nameInput = document.getElementById("nameInput");
const ageInput = document.getElementById("ageInput");
const genderInput = document.getElementById("genderInput");
const profileList = document.getElementById("profileList");

let selectedImage = null;
let hasFirstResponse = false;
let currentProfileId = null;
let accessToken = null;

document.addEventListener("DOMContentLoaded", async () => {
  accessToken = await loginAndGetToken();
  fetchAndDisplayProfiles();
});

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

submitBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  const name = nameInput.value.trim();
  const age = parseInt(ageInput.value.trim());
  const gender = genderInput.value;

  if (!selectedImage || !prompt || !name || !age || !gender) {
    alert("Please fill all fields and upload an image.");
    return;
  }

  submitBtn.classList.add("loading");
  submitBtn.innerText = "Analyzing...";

  try {
    // 1. Create new profile if not created
    if (!currentProfileId) {
      const profileRes = await fetch(`${API_URL}/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name, age, gender }),
      });

      const profileData = await profileRes.json();
      currentProfileId = profileData.id;
      saveProfileIdLocally(currentProfileId);
      console.log("Profile created:", profileData);

      const imageForm = new FormData();
      imageForm.append("image", selectedImage);

      await fetch(`${API_URL}/profiles/${currentProfileId}/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: imageForm,
      });
    }

    // 2. Send prompt to OpenAI backend
    const analysisForm = new FormData();
    analysisForm.append("image", selectedImage);
    analysisForm.append("user_prompt", prompt);

    const analysisRes = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      body: analysisForm,
    });

    const data = await analysisRes.json();
    const response = data.response || data.error || "No response received.";

    // 3. Save chat
    await fetch(`${API_URL}/profiles/${currentProfileId}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ prompt, response }),
    });

    if (!hasFirstResponse) {
      pageWrapper.classList.remove("centered");
      pageWrapper.classList.add("split");
      hasFirstResponse = true;
    }

    addToChatHistory(prompt, response);
    promptInput.value = "";
  } catch (err) {
    console.error(err);
    alert("Error during profile creation or analysis.");
  } finally {
    submitBtn.classList.remove("loading");
    submitBtn.innerText = "Analyze";
  }
});

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

async function loginAndGetToken() {
  const formData = new URLSearchParams();
  formData.append("username", "testuser1");
  formData.append("password", "testuser1");

  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });

  const data = await res.json();
  return data.access_token;
}

const LOCAL_PROFILE_KEY = "my_device_profiles";

function saveProfileIdLocally(id) {
  const ids = getLocalProfileIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(ids));
  }
}

function getLocalProfileIds() {
  const data = localStorage.getItem(LOCAL_PROFILE_KEY);
  return data ? JSON.parse(data) : [];
}

async function fetchAndDisplayProfiles() {
  const res = await fetch(`${API_URL}/profiles`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const allProfiles = await res.json();
  const localIds = getLocalProfileIds();
  const localProfiles = allProfiles.filter(p => localIds.includes(p.id));

  profileList.innerHTML = ""; // clear list

  localProfiles.forEach(p => {
    const item = document.createElement("div");
    item.className = "profile-item";
    item.textContent = `${p.name} (${p.age})`;

    item.onclick = () => {
      setActiveProfile(item);
      loadProfile(p.id);
    };

    profileList.appendChild(item);
  });
}

function setActiveProfile(selected) {
  const items = document.querySelectorAll(".profile-item");
  items.forEach(el => el.classList.remove("active"));
  selected.classList.add("active");
}

async function loadProfile(profileId) {
  currentProfileId = profileId;
  hasFirstResponse = true;

  const res = await fetch(`${API_URL}/profiles/${profileId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = await res.json();

  // Show panel layout
  pageWrapper.classList.remove("centered");
  pageWrapper.classList.add("split");

  // Show first image
  if (profile.images.length > 0) {
    previewImage.src = `/${profile.images[0].file_path}`; // If local
    previewImage.classList.remove("hidden");
    promptContainer.classList.remove("hidden");
  }

  // Load chat history
  chatHistory.innerHTML = ""; // clear old chat
  profile.chats.forEach(chat => {
    addToChatHistory(chat.user_prompt, chat.ai_response);
  });
}

const API_URL = "https://vision-api.onrender.com";

const imageInput = document.getElementById("imageInput");
const previewImage = document.getElementById("previewImage");
const profileFormContainer = document.getElementById("profileFormContainer");
const thumbnailGallery = document.getElementById("thumbnailGallery");
const chatHistory = document.getElementById("chatHistory");
const promptContainer = document.getElementById("promptContainer");
const promptInput = document.getElementById("promptInput");
const submitBtn = document.getElementById("submitBtn");
const profileList = document.getElementById("profileList");
const newChatBtn = document.getElementById("newChatBtn");

const nameInput = document.getElementById("nameInput");
const ageInput = document.getElementById("ageInput");
const genderInput = document.getElementById("genderInput");

const LOCAL_PROFILE_KEY = "my_device_profiles";
const LAST_PROFILE_KEY = "last_selected_profile";

let accessToken = null;
let selectedImage = null;
let currentProfileId = null;

document.addEventListener("DOMContentLoaded", async () => {
  accessToken = await loginAndGetToken();
  await fetchAndDisplayProfiles();

  const lastProfileId = getLastOpenedProfile();
  if (lastProfileId) loadProfile(parseInt(lastProfileId));
  else showProfileForm();
});

newChatBtn.addEventListener("click", () => {
  showProfileForm();
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (file) selectedImage = file;
});

submitBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  submitBtn.disabled = true;
  submitBtn.innerText = "Analyzing...";

  try {
    // 1. Create profile if needed
    if (!currentProfileId) {
      const name = nameInput.value.trim();
      const age = parseInt(ageInput.value.trim());
      const gender = genderInput.value;

      if (!selectedImage || !name || !age || !gender) {
        alert("Please fill all fields and upload an image.");
        return;
      }

      const profileRes = await fetch(`${API_URL}/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name, age, gender }),
      });

      const profile = await profileRes.json();
      currentProfileId = profile.id;
      saveProfileIdLocally(currentProfileId);
      setLastOpenedProfile(currentProfileId);

      const imgForm = new FormData();
      imgForm.append("image", selectedImage);

      await fetch(`${API_URL}/profiles/${currentProfileId}/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: imgForm,
      });

      await fetchAndDisplayProfiles();
    }

    // 2. Call analyze
    const analysisForm = new FormData();
    analysisForm.append("image", selectedImage);
    analysisForm.append("user_prompt", prompt);

    const analysisRes = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      body: analysisForm,
    });

    const data = await analysisRes.json();
    const response = data.response || data.error || "No response.";

    // 3. Save chat
    await fetch(`${API_URL}/profiles/${currentProfileId}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ prompt, response }),
    });

    addToChatHistory(prompt, response);
    promptInput.value = "";

    // Refresh profile to load images if needed
    loadProfile(currentProfileId);
  } catch (err) {
    console.error(err);
    alert("Something went wrong.");
  } finally {
    submitBtn.disabled = false;
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

async function fetchAndDisplayProfiles() {
  const res = await fetch(`${API_URL}/profiles`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const allProfiles = await res.json();
  const localIds = getLocalProfileIds();
  const localProfiles = allProfiles.filter(p => localIds.includes(p.id));

  profileList.innerHTML = "";
  localProfiles.forEach(p => {
    const item = document.createElement("div");
    item.className = "profile-item";
    item.textContent = `${p.name} (${p.age})`;
    if (p.id === parseInt(getLastOpenedProfile())) item.classList.add("active");

    item.onclick = () => {
      setLastOpenedProfile(p.id);
      loadProfile(p.id);
    };

    profileList.appendChild(item);
  });
}

async function loadProfile(profileId) {
  currentProfileId = profileId;
  chatHistory.innerHTML = "";
  thumbnailGallery.innerHTML = "";

  const res = await fetch(`${API_URL}/profiles/${profileId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await res.json();

  promptContainer.classList.remove("hidden");
  profileFormContainer.classList.add("hidden");

  if (profile.images.length) {
    thumbnailGallery.classList.remove("hidden");
    profile.images.forEach(img => {
      const thumb = document.createElement("img");
      thumb.src = `${API_URL}/${img.file_path}`;
      thumbnailGallery.appendChild(thumb);
    });
  }

  profile.chats.forEach(c => {
    addToChatHistory(c.user_prompt, c.ai_response);
  });
}

async function loginAndGetToken() {
  const formData = new URLSearchParams();
  formData.append("username", "testuser1");
  formData.append("password", "testuser1");

  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  const data = await res.json();
  return data.access_token;
}

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

function setLastOpenedProfile(id) {
  localStorage.setItem(LAST_PROFILE_KEY, id);
}

function getLastOpenedProfile() {
  return localStorage.getItem(LAST_PROFILE_KEY);
}

function showProfileForm() {
  profileFormContainer.classList.remove("hidden");
  chatHistory.innerHTML = "";
  thumbnailGallery.classList.add("hidden");
  promptContainer.classList.remove("hidden");
  currentProfileId = null;
  setLastOpenedProfile("");
}

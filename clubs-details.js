document.addEventListener("DOMContentLoaded", () => {
  loadClub();
});

// Helper to safely extract profile whether returned as Object or Array
function extractProfile(profiles) {
  if (!profiles) return {};
  return Array.isArray(profiles) ? (profiles[0] || {}) : profiles;
}

// Fallback HTML sanitizer in case app.js hasn't loaded escapeHtml globally
function sanitize(val) {
  if (typeof escapeHtml === "function") return escapeHtml(val);
  return String(val ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadClub() {
  const urlParams = new URLSearchParams(window.location.search);
  const clubId = urlParams.get("id");

  if (!clubId) {
    showError("No club ID found in URL parameters.");
    return;
  }

  try {
    const supabase = getSupabase();

    // 1. Fetch main club details AND join leader profile via leader_id
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select(`
        *,
        leader:profiles!leader_id(full_name, branch, department, year)
      `)
      .eq("id", clubId)
      .single();

    if (clubError) throw clubError;
    if (!club) throw new Error("Club not found.");

    // 2. Fetch Members & Profiles (Includes both branch and department)
    const { data: membersData, error: membersError } = await supabase
      .from("club_members")
      .select(`
        role,
        profiles (
          full_name,
          branch,
          department,
          year
        )
      `)
      .eq("club_id", clubId);

    if (membersError) {
      console.warn("Could not fetch members:", membersError);
    }
    const members = membersData || [];

    // 3. Populate Basic HTML Elements
    const setElementText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setElementText("clubName", club.name || "Unnamed Club");
    setElementText("clubCategory", club.category || "");
    setElementText("clubDescription", club.description || "");
    setElementText("clubTagline", club.tagline || "");
    setElementText("infoCategory", club.category || "-");
    setElementText("infoMembers", members.length.toString()); 
    
    const emojiEl = document.getElementById("clubEmoji");
    if (emojiEl) emojiEl.textContent = club.emoji || "🏛️";

    // 4. Resolve Club Leader (First check leader_id join, then fallback to member role)
    let leaderProfile = extractProfile(club.leader);
    
    if (!leaderProfile.full_name) {
      const leaderMember = members.find(m => 
        m.role && (m.role.toLowerCase() === "leader" || m.role.toLowerCase() === "president")
      );
      leaderProfile = leaderMember ? extractProfile(leaderMember.profiles) : {};
    }

    if (leaderProfile.full_name) {
      const dept = leaderProfile.branch || leaderProfile.department || "No Branch";
      const year = leaderProfile.year ? `Year ${leaderProfile.year}` : "N/A";

      setElementText("leaderName", leaderProfile.full_name);
      setElementText("leaderDetails", `${dept} • ${year}`);
      
      const leaderAvatar = document.getElementById("leaderAvatar");
      if (leaderAvatar) {
        leaderAvatar.textContent = leaderProfile.full_name.charAt(0).toUpperCase();
      }
    } else {
      setElementText("leaderName", "No Leader Assigned");
      setElementText("leaderDetails", "-");
    }

    // 5. Render Members List
    const membersContainer = document.getElementById("clubMembers");
    if (membersContainer) {
      if (members.length === 0) {
        membersContainer.innerHTML = `<div style="color:var(--text-muted);">No members yet. Be the first to join!</div>`;
      } else {
        membersContainer.innerHTML = ""; 
        
        members.forEach(member => {
          const profile = extractProfile(member.profiles);
          const memberName = profile.full_name || "Unknown Member";
          const initial = memberName.charAt(0).toUpperCase();
          const dept = profile.branch || profile.department || "No Branch";
          const year = profile.year ? `Year ${profile.year}` : "N/A";
          const role = member.role || "Member";

          const memberHtml = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
              <div class="club-person-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: var(--surface-3); display: flex; align-items: center; justify-content: center; font-weight: bold;">
                ${sanitize(initial)}
              </div>
              <div>
                <div class="club-person-name" style="font-weight: 500;">
                  ${sanitize(memberName)} 
                  <span style="font-size: 0.75rem; background: var(--surface-2); padding: 2px 8px; border-radius: 12px; margin-left: 6px; color: var(--text-muted);">
                    ${sanitize(role)}
                  </span>
                </div>
                <div class="club-person-meta" style="font-size: 0.85rem; color: var(--text-muted);">
                  ${sanitize(dept)} • ${sanitize(year)}
                </div>
              </div>
            </div>
          `;
          membersContainer.insertAdjacentHTML("beforeend", memberHtml);
        });
      }
    }

    // 6. Hide Loader & Show Content
    const loader = document.getElementById("clubLoading");
    if (loader) loader.style.display = "none";

    const content = document.getElementById("clubContent");
    if (content) {
      content.classList.remove("hidden");
      content.style.display = "block"; 
    }

  } catch (err) {
    console.error("Error inside loadClub():", err);
    showError(err.message || "Failed to retrieve club details.");
  }
}

function showError(message) {
  const loader = document.getElementById("clubLoading");
  if (loader) loader.style.display = "none";
  
  const errorDiv = document.getElementById("clubError");
  if (errorDiv) {
    errorDiv.classList.remove("hidden");
    errorDiv.style.display = "block";
  }
  
  const errorMsg = document.getElementById("clubErrorMessage");
  if (errorMsg) errorMsg.textContent = message;
}
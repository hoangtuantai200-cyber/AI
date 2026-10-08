const $ = id =>
  document.getElementById(id);


const state = {

  user:
    JSON.parse(
      localStorage.getItem(
        "BOT_NANO_USER"
      ) || "null"
    ),

  messages: [],

  busy: false,

  dark:
    localStorage.getItem(
      "BOT_NANO_DARK"
    ) === "1"

};


/* =========================
   THEME
========================= */

function applyTheme(){

  document.body.classList.toggle(
    "dark",
    state.dark
  );

  localStorage.setItem(
    "BOT_NANO_DARK",
    state.dark ? "1" : "0"
  );

}


/* =========================
   TOAST
========================= */

function toast(message){

  const el =
    $("toast");

  el.textContent =
    message;

  el.classList.add(
    "show"
  );

  clearTimeout(
    toast.timer
  );

  toast.timer =
    setTimeout(
      () => {
        el.classList.remove(
          "show"
        );
      },
      2500
    );

}


/* =========================
   RESIZE INPUT
========================= */

function resizeInput(){

  const input =
    $("input");

  input.style.height =
    "auto";

  input.style.height =
    Math.min(
      input.scrollHeight,
      180
    ) + "px";

}


/* =========================
   SCROLL
========================= */

function scrollBottom(){

  const chat =
    $("chat");

  requestAnimationFrame(
    () => {
      chat.scrollTop =
        chat.scrollHeight;
    }
  );

}


/* =========================
   WELCOME
========================= */

function updateWelcome(){

  const welcome =
    $("welcome");

  if(state.messages.length){

    welcome.style.display =
      "none";

  }else{

    welcome.style.display =
      "";

  }

  $("userName").textContent =
    state.user?.name ||
    "bạn";

}


/* =========================
   MESSAGE
========================= */

function addMessage(
  role,
  content
){

  const message =
    document.createElement(
      "div"
    );

  message.className =
    "message " + role;


  const avatar =
    document.createElement(
      "div"
    );

  avatar.className =
    "avatar";

  avatar.textContent =
    role === "user"
      ? "Bạn"
      : "N";


  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "bubble";

  bubble.textContent =
    content;


  message.append(
    avatar,
    bubble
  );


  $("messages")
    .appendChild(
      message
    );


  scrollBottom();


  return bubble;

}


/* =========================
   HISTORY
========================= */

function addHistory(text){

  if(!text)
    return;

  const history =
    $("history");


  if(
    history.children.length >= 10
  ){
    history.lastElementChild
      .remove();
  }


  const item =
    document.createElement(
      "div"
    );

  item.className =
    "history-item";

  item.textContent =
    text;


  history.prepend(
    item
  );

}


/* =========================
   CREATE USER
========================= */

async function createUser(
  name
){

  const response =
    await fetch(
      "/api/user",
      {
        method:"POST",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            name
          })
      }
    );


  const data =
    await response.json();


  if(!response.ok){

    throw new Error(
      data.error ||
      "Không thể tạo người dùng."
    );

  }


  state.user =
    data;


  localStorage.setItem(
    "BOT_NANO_USER",
    JSON.stringify(
      data
    )
  );

}


/* =========================
   NAME
========================= */

async function saveName(){

  const input =
    $("nameInput");

  const name =
    input.value.trim();


  if(!name){

    toast(
      "Vui lòng nhập tên."
    );

    return;

  }


  $("startBtn")
    .disabled = true;


  try{

    await createUser(
      name
    );


    $("nameModal")
      .classList.add(
        "hidden"
      );


    updateWelcome();

    $("input")
      .focus();


  }catch(error){

    toast(
      error.message
    );

  }finally{

    $("startBtn")
      .disabled = false;

  }

}


/* =========================
   SEND MESSAGE
========================= */

async function sendMessage(
  text
){

  if(
    state.busy ||
    !text.trim()
  ){
    return;
  }


  state.busy =
    true;


  $("send")
    .disabled = true;


  const message =
    text.trim();


  state.messages.push({
    role:"user",
    content:message
  });


  addMessage(
    "user",
    message
  );


  addHistory(
    message
  );


  $("input").value =
    "";

  resizeInput();


  const replyBubble =
    addMessage(
      "assistant",
      "Đang suy nghĩ..."
    );


  replyBubble
    .classList.add(
      "typing"
    );


  try{

    /*
     * Chỉ gửi 12 tin gần nhất.
     * Không gửi ảnh/file.
     */

    const history =
      state.messages
        .slice(-12, -1);


    const response =
      await fetch(
        "/api/chat",
        {
          method:"POST",

          headers:{
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              message,

              history,

              name:
                state.user?.name ||
                ""

            })
        }
      );


    const data =
      await response.json();


    if(!response.ok){

      throw new Error(
        data.error ||
        "Lỗi máy chủ."
      );

    }


    replyBubble
      .classList.remove(
        "typing"
      );


    replyBubble.textContent =
      data.reply;


    state.messages.push({
      role:"assistant",
      content:data.reply
    });


  }catch(error){

    replyBubble
      .classList.remove(
        "typing"
      );


    replyBubble.textContent =
      "Không thể trả lời: " +
      error.message;


    toast(
      error.message
    );


  }finally{

    state.busy =
      false;

    $("send")
      .disabled = false;

    $("input")
      .focus();

    updateWelcome();

    scrollBottom();

  }

}


/* =========================
   EVENTS
========================= */

$("composer")
  .addEventListener(
    "submit",
    event => {

      event.preventDefault();

      sendMessage(
        $("input").value
      );

    }
  );


$("input")
  .addEventListener(
    "input",
    resizeInput
  );


$("input")
  .addEventListener(
    "keydown",
    event => {

      if(
        event.key === "Enter" &&
        !event.shiftKey
      ){

        event.preventDefault();

        $("composer")
          .requestSubmit();

      }

    }
  );


$("startBtn")
  .addEventListener(
    "click",
    saveName
  );


$("nameInput")
  .addEventListener(
    "keydown",
    event => {

      if(
        event.key === "Enter"
      ){

        saveName();

      }

    }
  );


$("newChat")
  .addEventListener(
    "click",
    () => {

      state.messages =
        [];

      $("messages")
        .innerHTML = "";

      updateWelcome();

      $("input")
        .focus();

      $("sidebar")
        .classList.remove(
          "open"
        );

    }
  );


$("clearBtn")
  .addEventListener(
    "click",
    () => {

      state.messages =
        [];

      $("messages")
        .innerHTML = "";

      updateWelcome();

    }
  );


$("themeBtn")
  .addEventListener(
    "click",
    () => {

      state.dark =
        !state.dark;

      applyTheme();

    }
  );


$("languageBtn")
  .addEventListener(
    "click",
    () => {

      toast(
        "BOT NANO hiện đang dùng Tiếng Việt."
      );

    }
  );


$("menuBtn")
  .addEventListener(
    "click",
    () => {

      $("sidebar")
        .classList.toggle(
          "open"
        );

    }
  );


document
  .querySelectorAll(
    ".suggestions button"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          sendMessage(
            button.dataset.prompt
          );

        }
      );

    }
  );


/* =========================
   START
========================= */

applyTheme();

if(state.user?.name){

  $("nameModal")
    .classList.add(
      "hidden"
    );

}else{

  $("nameModal")
    .classList.remove(
      "hidden"
    );

}

updateWelcome();
import {
  ConfigFormBuilder,
  Context,
  Devvit,
  RedditAPIClient,
} from "@devvit/public-api";

const reddit = new RedditAPIClient();

Devvit.use(Devvit.Types.HTTP);

Devvit.onPostSubmit(async (info, meta) => {
  const sub = await reddit.getCurrentSubreddit(meta);
  if (!info.post) {
    return {
      message: "Skipped, no post.",
    };
  }

  if(sub.name.toLowerCase() != "ffxvi") return { message: "Skipped, Subreddit not FFXVI"};

  const post = await reddit.getPostById(info.post.id, meta);
  if (post.removed || post.spam || post.hidden) return { meessage: "Ok" };

  var subredditIcon = sub.settings.communityIcon;

  const contentWarnings = [];
  if (info.post.isSpoiler) contentWarnings.push("Spoiler");
  if (info.post.nsfw) contentWarnings.push("NSFW");

  var body = post.body?.substring(0, 400) ?? "No Description";
  if(body.includes(">!") && post.body?.includes("<!")) {
    body = body.replace(">!", "||");
    if(body.includes("<!")) {
      body = body.replace("<!", "||");
    } else {
      body += "||";
    }
  }

  const webhookUrl = "(WEBHOOK URL)";
  const response = await fetch(webhookUrl + "?wait=true", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: "",
      username: "r/" + sub.name,
      avatar_url: subredditIcon,
      tts: false,
      embeds: [
        {
          title: info.post.title,
          type: "rich",
          description: body,
          url: info.post.url,
          fields: [
            ...(contentWarnings.length > 0
              ? [
                  {
                    name: "Content Warning",
                    value: contentWarnings.join(", "),
                  },
                ]
              : []),
          ],
        },
      ],
      author: {
        name: info.author ? "Posted by u/" + info.author.name : null,
        url: info.author ? "https://reddit.com/u/" + info.author.name : null,
      },
    }),
  });

  const data = await response.json();

  const messageId = data["id"] as string;

  return {
    message: "Ok (" + messageId + ")",
  };
});

const replaceCdn = (text: string) => {
  return text.replace("cdn;", "https://cdn.xvibot.com")
}

Devvit.addAction({
  context: [Context.COMMENT, Context.POST],
  name: "Attach Skill",
  description: "Search for a skill, and attach it to this post/message.",
  userInput: new ConfigFormBuilder()
    .textField("skillName", "Skill Search")
    .build(),
  handler: async (event, meta) => {
    const skillNameField = event.userInput?.fields.find(
      (f) => f.key == "skillName"
    );

    const response = await fetch(
      "https://xvibot.com/api/skill/search?skillName=" + skillNameField
    );

    const data = await response.json();

    var commentId: string | null = null;
    if (event.context == Context.POST) {
      commentId = event.post.name ?? null;
    } else if (event.context == Context.COMMENT) {
      commentId = event.comment.name ?? null;
    }

    if (commentId == null) {
      return {
        success: false,
        message: "Failed to find message id",
      };
    }

    const title = "**" + data["name"] + "**";
    const skillIcon = "[Icon](" + replaceCdn(data["iconUrl"]) + ")";
    const skillPreview = "[Preview](" + replaceCdn(data["previewImageUrl"]) + ")";

    var description = data["description"] as string;
    
    const regex = RegExp(/<:button_(\w*):\d*>/g);
    const regResult = description.matchAll(regex);
    const regArr = Array.from(regResult);
    for (let regIndex = 0; regIndex < regArr.length; regIndex++) {
      const match = regArr[regIndex];

      const [found, button] = match;
      description = description.replace(found, button.toUpperCase());
    }

    var cost = "Cost: " + data["costBuy"];
    if(data["costUpgrade"] && data["costUpgrade"] != 0) {
      cost += " / " + data["costUpgrade"];
    }
    if(data["costMaster"] && data["costMaster"] != 0) {
      cost += " / " + data["costMaster"];
    }


    const body = title + " - " + skillIcon + " - " + skillPreview + "\n\n" + description + "\n\n" + cost;

    await reddit.submitComment(
      {
        id: commentId,
        text: body,
      },
      meta
    );

    return {
      success: true,
      message: "Ok",
    };
  },
});

export default Devvit;

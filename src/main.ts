import {
  ConfigFormBuilder,
  Context,
  Devvit,
  RedditAPIClient,
} from "@devvit/public-api";

const reddit = new RedditAPIClient();
const formBuilder = new ConfigFormBuilder();

Devvit.use(Devvit.Types.HTTP);

Devvit.onCommentSubmit(async (submitEvent, _) => {
  console.log("Is Parent: ", submitEvent.comment?.parentId);
  console.log("Author: ", submitEvent.author?.id);

  return {
    message: "Ok",
  };
});

Devvit.onPostSubmit(async (info, meta) => {
  const sub = await reddit.getCurrentSubreddit(meta);
  if (!info.post) {
    return {
      message: "Ok",
    };
  }

  const post = await reddit.getPostById(info.post.id, meta);
  if (post.removed || post.spam || post.hidden) return { meessage: "Ok" };

  var subredditIcon = sub.settings.communityIcon;

  const contentWarnings = [];
  if (info.post.isSpoiler) contentWarnings.push("Spoiler");
  if (info.post.nsfw) contentWarnings.push("NSFW");

  const response = await fetch("discord-webhookurl", {
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
          description: post.body?.substring(0, 400) ?? "No Description",
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

Devvit.onPostUpdate(async (_1, _2) => {
  return { message: "Ok" };
});

Devvit.addAction({
  context: Context.COMMENT,
  name: "Discord Webhook",
  description: "Sends a Webhook of this message to discord",
  handler: async (event, meta) => {
    const { comment } = event;

    const sub = await reddit.getCurrentSubreddit(meta);
    var subredditIcon = sub.settings.communityIcon;

    const response = await fetch("discord-webhookurl", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "",
        username: "r/" + comment.subreddit,
        avatar_url: subredditIcon,
        tts: false,
        embeds: [
          {
            title: comment.title ?? "New Comment",
            type: "rich",
            description: comment.body,
            url: comment.linkUrl,
          },
        ],
        author: {
          name: "u/" + comment.author,
        },
      }),
    });

    return {
      success: true,
      message: `Invoked HTTP request on comment: ${comment?.body}. Completed with status: ${response.status}`,
    };
  },
});

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

    await reddit.submitComment(
      {
        id: commentId,
        text: data["description"] as string,
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

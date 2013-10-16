var $radio = $('.auto-submit-star');
var $btn = $('#btn-post');
var $textArea = $('#com-body');
var $stream = $('#stream');
var $firstReview = $('.com-first-review');
var $alert = $('.com-alert');
var $sort = $('.com-sort');
var windowProxy;

var onMessage = function (messageEvent) {
    console.log(messageEvent);
};

var didILike = function (review, username) {
    var likes = review.likes && review.likes.items;
    if (likes) {
        for (var j = 0; j < likes.length; j++) {
            var like = likes[j];
            if (like.id == username) {
                return true;
            }
        }
    }
    return false;
};

var publish = function (activity, onSuccess) {
    if (activity.target) {
        activity.context = {"id": target};
    } else {
        activity.target = {"id": target};
    }
    activity.actor = {"id": user, "objectType": "person" };
    $.get('apis/comments.jag', {
        activity: JSON.stringify(activity)
    }, onSuccess)
};

var adjustHeight = function () {
	var docHeight = $(document).height();
    windowProxy.post({'expanded':docHeight});
};

var showAlert = function (msg) {
    $alert.html(msg).fadeIn("fast").css('display', 'inline-block');
};

var showLoading = function (status) {
    if (status) {
        $alert.html('').css('display', 'inline-block').addClass('com-alert-wait');
    } else {
        $alert.hide().removeClass('com-alert-wait');
    }
};

var usingTemplate = function (callback) {
    caramel.partials({activity: 'themes/' + caramel.themer + '/partials/activity.hbs'}, function () {
        callback(Handlebars.partials['activity']);
    });
};

$(function () {
    windowProxy = new Porthole.WindowProxy();
    windowProxy.addEventListener(onMessage);
    setTimeout(adjustHeight,1000);
});

$radio.rating({
    callback: function (value) {
    }
});

$btn.click(function (e) {
    e.preventDefault();
    var rating = Number($('input.star-rating-applied:checked').val());
    var review = $textArea.val();

    if (!review && !rating) {
        showAlert("Please add your Review and Rating");
    } else if (!review) {
        showAlert("Please add your Review");
    } else if (!rating) {
        showAlert("Please add your Rating");
    } else {
        var activity = {"verb": "post",
            "object": {"objectType": "review", "content": review, rating: rating}
        };

        $btn.attr('disabled', 'disabled');
        showLoading(true);

        var pos = target.indexOf(':');
        var aid = target.substring(pos + 1);
        var type = target.substring(0, pos);


        var callback = function () {
            $('#newest').addClass('selected');
            $.get("/store/apis/rate", {
                id: aid,
                type: type,
                value: rating
            }, function (r) {
                publish(activity, function (published) {
                    if ($firstReview.length) {	
                    	$firstReview.hide();
                    	$sort.removeClass('com-sort-hidden');
                    }
                    $btn.removeAttr('disabled');
                    

                    if (published.success) {
                        showLoading(false);
                        $radio.rating('select', null);
                        $textArea.val('');

                        activity.id = published.id;
                        usingTemplate(function (template) {
                            var newComment = template(activity);
                            $stream.prepend(newComment);
                            if (adjustHeight) {
                                adjustHeight();
                            }
                        });
                    }
                });
            });
        };

        if ($('#newest').hasClass('selected')) {
            callback();
        } else {
            redrawReviews("bla", callback);
        }
    }
});

$stream.on('click', '.icon-thumbs-up', function (e) {
    e.preventDefault();
    var $likeBtn = $(e.target);
    var $review = $likeBtn.parents('.com-review');
    var id = $review.attr('data-target-id');
    var $likeCount = $review.find('.com-like-count');

    var activity = { target: {id: id} };

    if ($likeBtn.hasClass('selected')) {
        activity.verb = 'unlike';
        publish(activity, function () {
            $likeCount.text((Number($likeCount.text()) - 1) || '');
        });
        $likeBtn.removeClass('selected');
    } else {
        activity.verb = 'like';
        publish(activity, function () {
            $likeCount.text(Number($likeCount.text()) + 1);
        });
        $likeBtn.addClass('selected');
    }

});

var redrawReviews = function (sortBy, callback) {
    $('.com-sort .selected').removeClass('selected');
    $.get('apis/object.jag', {
        target: target,
        sortBy: sortBy
    }, function (obj) {
        var reviews = obj.attachments || [];
        usingTemplate(function (template) {
            var str = "";
            for (var i = 0; i < reviews.length; i++) {
                var review = reviews[i];
                var iLike = didILike(review, user);
                review.iLike = iLike;
                console.log(iLike);
                str += template(review);
            }
            $stream.html(str);
            callback && callback();
        });
    })
};

$(document).on('click', '.com-sort a', function (e) {
    var $target = $(e.target);
    if (!$target.hasClass('selected')) {
        redrawReviews($target.text().toUpperCase());
        $target.addClass('selected');
    }
});


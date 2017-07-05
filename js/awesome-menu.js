        jQuery(function() {
        	function slideMenu() {
        		var activeState = jQuery('#menu-container .menu-list').hasClass('active');
        		jQuery('#menu-container .menu-list').animate({
        			left: activeState ? '0%' : '-100%'
        		}, 400);
        	}
        	jQuery('#menu-wrapper').click(function(event) {
        		event.stopPropagation();
        		jQuery('#hamburger-menu').toggleClass('open');
        		jQuery('#menu-container .menu-list').toggleClass('active');
             slideMenu();

        		jQuery('body').toggleClass('overflow-hidden');
        	});
          
        jQuery(".menu-list").find('.accordion-toggle').click(function() {
        jQuery(this).toggleClass("active-tab").find("span").toggleClass("icon-minus icon-plus");
        jQuery(this).next().toggleClass("open").slideToggle("fast");
        jQuery(".menu-list .accordion-content").not(jQuery(this).next()).slideUp("fast").removeClass("open");
        jQuery(".menu-list .accordion-toggle").not(jQuery(this)).removeClass("active-tab").find("span").removeClass("icon-minus").addClass("icon-plus")
    });
          
        }); // jQuery load